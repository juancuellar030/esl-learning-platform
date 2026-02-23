/**
 * Shared Student Data Module
 * Central source of truth for student names and birthdates.
 * Birthdate format: 'MM-DD'
 */
const STUDENTS_DATA = [
    { name: 'PABLO A.', birthdate: '09-29' },  // ALEGRÍA PLAZAS PABLO JOSÉ
    { name: 'LAURA BERNAL', birthdate: '01-04' },  // BERNAL MOTTA LAURA VALENTINA
    { name: 'ANAMARIA C.', birthdate: '01-08' },  // CABRERA MENDEZ ANAMARIA
    { name: 'ALEJANDRO C.', birthdate: '12-17' },  // CARRILLO GOMEZ ALEJANDRO
    { name: 'BRIANA C.', birthdate: '12-22' },  // CASTRO LEYTON BRIANA ALETH
    { name: 'KESHIA C.', birthdate: '07-21' },  // CELORIO OVIEDO KESHIA CAROLINA
    { name: 'THOMAS C.', birthdate: '04-11' },  // CERQUERA MONTEALEGRE THOMAS
    { name: 'SAMANTHA C', birthdate: '03-27' },  // CÉSPEDEZ CORTES SAMANTHA
    { name: 'MATIAS F.', birthdate: '05-05' },  // FIERRO JOVEN MATIAS
    { name: 'SAMUEL G.', birthdate: '08-09' },  // GUTIERREZ HUELGO SAMUEL
    { name: 'MIA H.', birthdate: '10-17' },  // HERNANDEZ DUSSAN MIA
    { name: 'ALEJANDRA H.', birthdate: '01-20' },  // HUERTAS JAIMES ALEJANDRA
    { name: 'JUANA LUNA', birthdate: '07-23' },  // LUNA CALDERON JUANA VICTORIA
    { name: 'LUCIANO M.', birthdate: '10-05' },  // MOTTA BERNATE LUCIANO
    { name: 'SANTIAGO O.', birthdate: '02-11' },  // OTALORA BARBOSA SANTIAGO ANDRÉS
    { name: 'DANIEL P.', birthdate: '02-18' },  // PATIÑO RICO DANIEL
    { name: 'VALERIA P.', birthdate: '04-21' },  // PEÑA OSORIO VALERIA
    { name: 'ANTONELLA P.', birthdate: '04-04' },  // PENNA LAISECA ANTONELLA
    { name: 'EVA MARIA P.', birthdate: '09-19' },  // PEREZ LOPEZ EVA MARIA
    { name: 'DANNA P.', birthdate: '02-23' },  // PORTILLA BENITEZ DANNA
    { name: 'EMILIANO Q.', birthdate: '11-18' },  // QUIROZ GARCIA EMILIANO
    { name: 'LORENZO R.', birthdate: '10-25' },  // RAMOS VARGAS LORENZO
    { name: 'EMILIO R.', birthdate: '11-24' },  // RENDON CUELLAR EMILIO
    { name: 'JUAN J. RÍOS', birthdate: '06-22' },  // RIOS SERRATO JUAN JOSÉ
    { name: 'JUAN J. SARRIAS', birthdate: '01-09' },  // RODRIGUEZ SARRIAS JUAN JOSÉ
    { name: 'LAURA S.', birthdate: '09-28' },  // SANDOVAL SANCHEZ LAURA
    { name: 'EMILIANO T.', birthdate: '10-11' },  // TAMAYO TORRES EMILIANO
    { name: 'SARA LUCÍA V.', birthdate: '04-19' },  // VANEGAS TORRES SARA LUCÍA
    { name: 'PAULA V.', birthdate: '03-13' },  // VICTORIA HERNANDEZ PAULA ANDREA
    { name: 'ERMES V.', birthdate: '12-10' },  // VIEDA DIAZ ERMES SANTIAGO
];

// Backward-compatible flat array of names for existing trackers
const studentNames = STUDENTS_DATA.map(s => s.name);
