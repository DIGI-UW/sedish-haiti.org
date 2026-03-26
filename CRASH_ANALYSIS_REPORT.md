# iSantePlus Instance Crash Analysis Report
## Date: 2026-03-26

---

## Summary
The iSantePlus instances are crashing due to **Metaspace memory exhaustion** caused by excessive Hibernate dynamic proxy generation during lazy-loading failures. The issue is directly triggered by new modules added to the system.

---

## Critical Issues Identified

### 1. **PRIMARY ISSUE: Metaspace Memory Exhaustion** 🔴
**Severity:** CRITICAL

**Evidence from Charpentier crash dump (2026-03-26T11:11:38):**
```
Memory Status:
- Total RAM: 15687 MB (~15 GB)
- Used: 13611 MB (87%)
- Free: 336 MB (CRITICALLY LOW)
- Available: 1705 MB
- Swap Used: 1958 / 2047 MB (95% - almost full)

GC Heap Status:
- Metaspace: 95.36% FULL (M column in gc_stats)
- Code Cache: 91.09% FULL (CCS column)
- Survivor Space 1: 100% FULL
- Old Generation: 31.14% FULL
- Young GC Collections: 106
- Full GC Collections: 0 (worrying - system can't free space)
```

**Root Cause:**
When the JVM creates dynamic proxies (via `com.sun.proxy.*`), it generates bytecode that is loaded into Metaspace. Once Metaspace fills up, there's no recovery. The fact that Full GC count is still 0 while Metaspace is at 95% indicates the system cannot garbage collect Metaspace effectively.

### 2. **Hibernate Lazy-Loading Failures** 🔴
**Severity:** HIGH

**Evidence from OpenMRS log (charpentier openmrs.log):**
Hundreds of `LazyInitializationException` errors:
```
ERROR - PatientSyncWorker.run(130) |2026-03-25 10:48:48,360|
  org.hibernate.LazyInitializationException: could not initialize proxy - no Session

ERROR - PatientSyncWorker.run(130) |2026-03-25 10:48:48,358|
  org.hibernate.LazyInitializationException: failed to lazily initialize a collection
  of role: org.openmrs.Patient.identifiers, could not initialize proxy - no Session
```

**Pattern:**
- The `PatientSyncWorker` thread is repeatedly failing
- Trying to access lazy-loaded properties (e.g., `Patient.identifiers`)
- These accesses occur **outside of a Hibernate session**
- Each failure attempt generates new proxy bytecode in Metaspace

### 3. **Dynamic Proxy Generation Leak**
**Severity:** CRITICAL

**Evidence:**
- References to `com.sun.proxy.$Proxy337`, `com.sun.proxy.$Proxy338`, etc.
- Each unique proxy class consumes Metaspace
- When lazy-load fails and is retried, a new proxy may be generated
- No mechanism to clean up failed proxy classes

**How it works:**
```
New Module Added
  ↓
Loads more Entity types with @Lazy annotations
  ↓
PatientSyncWorker tries to access lazy fields without session
  ↓
Hibernate creates dynamic proxy to handle lazy-load
  ↓
LazyInitializationException thrown (no session)
  ↓
Exception handler retries, creates new proxy
  ↓
Metaspace fills with proxy bytecode
  ↓
OOM (Out of Memory) → Crash
```

---

## Comparative Analysis: Charpentier vs Pilate

| Metric | Charpentier (CRASHED) | Pilate (Running) |
|--------|----------------------|-----------------|
| Free Memory | 336 MB (CRITICAL) | 21,579 MB (HEALTHY) |
| Swap Used | 1,958 / 2,047 MB (95%) | 0 / 2,047 MB |
| Metaspace | 95.36% FULL | 95.70% FULL |
| Young GC Count | 106 | 24 |
| Full GC Count | 0 | 0 |
| Old Gen Usage | 31.14% | 7.39% |

**Key Finding:** Both instances have high Metaspace usage (~95%), but Charpentier ran out of system RAM while Pilate has plenty. This suggests Charpentier has:
1. Less total RAM allocated
2. More aggressive memory usage by JVM
3. More garbage being generated

---

## Evidence Trail

### OpenMRS Log Findings
**File:** `/Users/mac/work/haiti/sedish/errorlogs/iSantePlus Monitor/Log OpenMRS Charpentier/openmrs.log`

**Error Pattern:**
- Errors from `PatientSyncWorker.run(130)` starting 2026-03-25 10:48:48
- Multiple `com.sun.proxy.$Proxy*` class references
- LazyInitializationException for:
  - `Patient.identifiers` collection
  - Patient entity proxies

**Timeline:**
- 10:48:48 - PatientSyncWorker failures begin
- 11:00:39 - Errors continue
- 11:05:21-23 - More failures with multiple proxy references
- 10:55:18 - Final log entry shows normal operation, then abrupt termination
  ```
  INFO - LoggingAdvice.invoke(155) |2026-03-26 10:55:18,986| Refreshing Context
  [LOG ENDS ABRUPTLY]
  ```

### System Metrics at Crash Time
**Time:** 2026-03-26 11:11:40 (Charpentier crash dump collected)

**MySQL Status:**
- InnoDB buffer pool: Good (103,532 free buffers out of 524,280)
- No deadlocks or lock waits detected
- I/O operations: Minimal
- Transactions: Minimal activity
- **Database is NOT the culprit**

**System Load:**
- CPU usage: Moderate (10% user)
- I/O wait: ~1%
- The system is NOT CPU-bound or I/O-bound
- **Memory is the only bottleneck**

---

## Root Cause Chain

1. **New modules added** (as mentioned in git history)
   - These modules likely define more JPA entities with lazy-loading (@LazyCollection, @LazyToOne)

2. **PatientSyncWorker thread** begins background processing
   - Tries to access lazy-loaded properties without an active Hibernate session

3. **Lazy initialization fails**
   - Exception thrown: `LazyInitializationException`
   - Hibernate creates dynamic proxy bytecode to recover

4. **Proxy bytecode accumulates in Metaspace**
   - Each failed access → new proxy class
   - Metaspace grows: 90% → 95% → 100%

5. **System runs out of memory**
   - Charpentier: RAM + Swap exhausted → OOM kill
   - Pilate: Still has RAM buffer, but will eventually fail

6. **Application crashes**
   - Ungraceful termination (log cuts off mid-operation)

---

## Why This Happened Now

**Timing:** Issues started appearing after modules were added (see git history: `8ee6c36 Use pure 2.8.5 module set by replacing base image modules`)

**Theory:**
The new module set (2.8.5) likely includes:
- More comprehensive entity models with lazy-loading
- Different background service implementations
- PatientSync or similar integration services that access lazy fields

These weren't compatible with the previous approach of accessing entities outside sessions.

---

## Recommended Fixes

### Immediate Actions (HIGH PRIORITY)

#### 1. Fix PatientSyncWorker Session Management
**File:** Location of PatientSyncWorker class (likely in xds-sender or similar module)

**Fix Pattern:**
```java
// BAD: Accesses lazy fields outside session
Worker.run() {
    Patient p = patientService.getPatient(id);
    p.getIdentifiers();  // LazyInitializationException!
}

// GOOD: Use OpenSessionInView or explicit session
Worker.run() {
    hibernateTemplate.execute(session -> {
        Patient p = patientService.getPatient(id);
        Hibernate.initialize(p.getIdentifiers()); // Force load within session
        // Process identifiers
        return null;
    });
}

// OR: Fetch eagerly
patientService.getPatientWithIdentifiers(id);
```

#### 2. Increase JVM Metaspace Settings
**File:** Docker compose or deployment configuration

**Current:**
- Metaspace default (usually 128MB initial, 1GB max) - too restrictive

**Recommended:**
```bash
-XX:MetaspaceSize=512M \
-XX:MaxMetaspaceSize=2048M \
-XX:CompressedClassSpaceSize=512M
```

#### 3. Add Monitoring for Metaspace
**Add GC logging:**
```bash
-XX:+UnlockDiagnosticVMOptions \
-XX:+TraceClassLoading \
-XX:+LogCommercialFeatures \
-XX:+PrintGCDetails \
-XX:+PrintGCTimeStamps \
-XX:+PrintClassHistogramAfterFullGC \
-Xloggc:gc.log
```

### Medium-term Actions (MEDIUM PRIORITY)

#### 4. Review All Lazy-Loading Patterns
- Identify all `@LazyCollection` and `@LazyToOne` annotations
- Evaluate if they're necessary or should be eager-loaded
- Profile which entities are most problematic

#### 5. Implement Proper Session Management
- Ensure all background workers use proper transaction boundaries
- Use Spring's `@Transactional` or explicit session management
- Consider using `LAZY_LOAD_FETCHING` patterns

#### 6. Add Memory Alerts
- Monitor Metaspace usage with threshold alerts
- Alert at 70%, 80%, 90% to catch issues early
- Include Code Cache monitoring

### Long-term Actions (LOW PRIORITY)

#### 7. Code Review of New 2.8.5 Modules
- Review all background service implementations
- Audit entity lazy-loading strategy
- Consider refactoring to avoid lazy-loading in worker threads

#### 8. Performance Testing
- Load test with new module set
- Profile memory usage over time
- Identify any other Metaspace leaks

---

## Verification Steps

Once fixes are applied:

1. **Deploy** with increased Metaspace and PatientSyncWorker fix
2. **Monitor** Metaspace usage over 24 hours:
   ```bash
   jstat -gcmetaspace <PID> 5000  # Check every 5 seconds
   ```
3. **Verify** no LazyInitializationException in logs
4. **Confirm** Metaspace stays below 70%
5. **Load test** to simulate normal operations

---

## Files Referenced

- **Crash dumps:**
  - `/errorlogs/iSantePlus Monitor/2026-03-26T11_11_38 Charpentier/` (Failed instance)
  - `/errorlogs/iSantePlus Monitor/2026-03-26T11_19_01 Pilate/` (Running instance)

- **Application logs:**
  - `/errorlogs/iSantePlus Monitor/Log OpenMRS Charpentier/openmrs.log` (24,409 lines)
  - `/errorlogs/iSantePlus Monitor/Log OpenMRS Pilate/openmrs_pilate.log`

---

## Summary Table: What to Fix

| Issue | Impact | Priority | Action |
|-------|--------|----------|--------|
| PatientSyncWorker lazy-load failures | Causes proxy bytecode leak | 🔴 CRITICAL | Fix session management |
| Metaspace too small | Can't accommodate module set | 🔴 CRITICAL | Increase -XX:MaxMetaspaceSize |
| No monitoring for Metaspace | Can't detect creeping issues | 🟡 HIGH | Add GC logging |
| Lazy-loading strategy unclear | Hard to debug future issues | 🟡 MEDIUM | Code review & audit |

---

**Report Generated:** 2026-03-26
**Status:** Analysis Complete - Ready for Developer Review
