# Security Specification for WrestleTracker

## 1. Data Invariants
- A Tournament organizer must be the only one who can update tournament details.
- Only the organizer or assigned officials can record scores for matches.
- An athlete can only update their own profile (except for statistics, which are updated by match results).
- Brackets and Matches must belong to an existing tournament.
- Match winners must be one of the two competing athletes.

## 2. The "Dirty Dozen" Payloads

1. **Identity Spoofing**: Attempt to create a tournament where `organizerId` is not the current user.
2. **Privilege Escalation**: Attempt to update a Match `winnerId` as a random signed-in user.
3. **State Shortcutting**: Attempt to set a match status to "completed" without setting a winner.
4. **Resource Poisoning**: Attempt to create a tournament with a 1MB string in the `name` field.
5. **Orphaned Writes**: Attempt to create a Match for a `bracketId` that doesn't exist.
6. **Immutable Field Tampering**: Attempt to change the `createdAt` timestamp of a User profile.
7. **Cross-Tenant Access**: Attempt to read a private "draft" tournament as a non-organizer.
8. **Invalid Weight Class**: Attempt to set a weight class to a non-string value.
9. **Score Forgery**: Attempt to update scores for a match in a different tournament.
10. **Role Hijacking**: Attempt to update own user role to "admin" after initial creation.
11. **PII Leak**: Attempt to list all users and their email addresses as a non-admin.
12. **Future Date Exploitation**: Attempt to set `updatedAt` to a future date instead of `request.time`.

## 3. The Test Runner

```ts
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";

// Mock Test runner for Dirty Dozen
// Note: In this environment, we represent the tests conceptually.
```
