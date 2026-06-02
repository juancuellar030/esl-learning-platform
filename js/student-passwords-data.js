/**
 * Student Self-Assessment Passwords
 *
 * Passwords are generated deterministically from the shared STUDENT_GROUPS
 * roster so they stay stable without duplicating hundreds of names by hand.
 * Pattern: FirstName + special character + two digits.
 */
const STUDENT_PASSWORD_SPECIALS = ['/', '*', '%', '#', '$'];

function normalizePasswordToken(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z]/g, '');
}

function getStudentFirstName(fullName) {
    const parts = String(fullName || '').trim().split(/\s+/);
    const candidate = parts[2] || parts[parts.length - 1] || '';
    const normalized = normalizePasswordToken(candidate).toLowerCase();
    return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Student';
}

function stableStudentNumber(name, group) {
    const raw = `${group}:${name}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        hash = (hash * 31 + raw.charCodeAt(i)) % 10000;
    }
    return String((hash % 90) + 10).padStart(2, '0');
}

function buildStudentPasswords(groups) {
    const passwords = {};
    Object.keys(groups || {}).forEach(group => {
        (groups[group] || []).forEach((name, index) => {
            const firstName = getStudentFirstName(name);
            const special = STUDENT_PASSWORD_SPECIALS[index % STUDENT_PASSWORD_SPECIALS.length];
            passwords[name] = `${firstName}${special}${stableStudentNumber(name, group)}`;
        });
    });
    return passwords;
}

const STUDENT_PASSWORDS = buildStudentPasswords(
    typeof STUDENT_GROUPS !== 'undefined' ? STUDENT_GROUPS : {}
);
