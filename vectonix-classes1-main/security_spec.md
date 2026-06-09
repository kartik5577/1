# Security Specification for Vectonix DB

## Data Invariants
1. **User Identity**: A user document must have a UID matching the authenticated user. Only admins can assign roles other than 'student'.
2. **Access Control**: Educational content (notes, lectures, live classes) is restricted to users who have purchased the corresponding item or parent course, unless marked as 'isFree'.
3. **Immutability**: Fields like `createdAt` and `userId` in sales and reviews must be immutable after creation.
4. **Relational Integrity**: Subjects must belong to a valid course; Units must belong to a valid Note; Chapters must belong to a valid Unit.

## "The Dirty Dozen" Payloads (Failed Attempts)

1. **Identity Theft**: Creating a user profile with another user's UID.
2. **Privilege Escalation**: A student trying to update their role to 'admin'.
3. **Resource Poisoning**: Injecting a 2MB string into a `Notice` title.
4. **Orphaned Writes**: Creating a `Subject` for a non-existent `courseId`.
5. **Unauthorized Access**: Reading `secure/content` of a paid course without a purchase record.
6. **Timestamp Manipulation**: Setting a future `createdAt` date from the client.
7. **Bypassing Purchase**: Creating a `Sale` record with a $0 amount for a $500 course.
8. **Spamming Chat**: Sending a 50kb message in a live class chat.
9. **Corrupting Reviews**: Updating an approved review's content as a non-admin.
10. **State Shortcutting**: Marking a live class as 'completed' as a student.
11. **ID Injection**: Using a path variable like `{noticeId}` containing malicious character sequences.
12. **Ghost Fields**: Adding `isAdmin: true` to a standard user profile update.

## Hardened Security Rules Strategy
1. **Validation Blueprints**: Reusable `isValid[Entity]` functions for all collections.
2. **Master Gate**: Access to content derived from purchase records in the user document.
3. **Identity Hardening**: `request.auth.uid` mandatory for all private data access.
4. **Size Enforcement**: Every string and array restricted by `.size()`.
