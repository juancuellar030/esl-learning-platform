/**
 * Shared Teacher Data Module
 * Central source of truth for teacher names and birthdates.
 * Birthdate format: 'MM-DD'
 *
 * Mirrors the shape used by STUDENTS_DATA in students-data.js so both
 * rosters can be read by the same tools.
 */

const TEACHERS_DATA = [
    { name: 'Natalia Castro', birthdate: '07-31' },               // Teacher
    { name: 'Mónica Charry', birthdate: '08-17' },                // Orientadora escolar
    { name: 'Catalina Diaz', birthdate: '09-09' },                // Coordinadora de Convivencia
    { name: 'Mildreth Perdomo', birthdate: '09-18' },             // Teacher
    { name: 'Liliana Peña', birthdate: '11-05' },                 // Coordinadora académica
    { name: 'Ingrid Diaz', birthdate: '12-20' },                  // Teacher
];

// Backward-compatible flat array of names, matching the studentNames pattern.
const teacherNames = TEACHERS_DATA.map(t => t.name);
