/**
 * Shared Student Data Module
 * Central source of truth for student names and birthdates.
 * Birthdate format: 'MM-DD'
 */
const STUDENTS_DATA = [
    { name: 'ALEJANDRA H.', birthdate: '01-20' },  // HUERTAS JAIMES ALEJANDRA
    { name: 'ALEJANDRO C.', birthdate: '12-17' },  // CARRILLO GOMEZ ALEJANDRO
    { name: 'ANAMARIA C.', birthdate: '01-08' },  // CABRERA MENDEZ ANAMARIA
    { name: 'ANTONELLA P.', birthdate: '04-04' },  // PENNA LAISECA ANTONELLA
    { name: 'BRIANA C.', birthdate: '12-22' },  // CASTRO LEYTON BRIANA ALETH
    { name: 'DANIEL P.', birthdate: '02-18' },  // PATIÑO RICO DANIEL
    { name: 'DANNA P.', birthdate: '02-23' },  // PORTILLA BENITEZ DANNA
    { name: 'EMILIANO Q.', birthdate: '11-18' },  // QUIROZ GARCIA EMILIANO
    { name: 'EMILIANO T.', birthdate: '10-11' },  // TAMAYO TORRES EMILIANO
    { name: 'EMILIO R.', birthdate: '11-24' },  // RENDON CUELLAR EMILIO
    { name: 'ERMES V.', birthdate: '12-10' },  // VIEDA DIAZ ERMES SANTIAGO
    { name: 'EVA MARIA P.', birthdate: '09-19' },  // PEREZ LOPEZ EVA MARIA
    { name: 'JUAN J. RÍOS', birthdate: '06-22' },  // RIOS SERRATO JUAN JOSÉ
    { name: 'JUAN J. SARRIAS', birthdate: '01-09' },  // RODRIGUEZ SARRIAS JUAN JOSÉ
    { name: 'JUANA LUNA', birthdate: '07-23' },  // LUNA CALDERON JUANA VICTORIA
    { name: 'KESHIA C.', birthdate: '07-21' },  // CELORIO OVIEDO KESHIA CAROLINA
    { name: 'LAURA BERNAL', birthdate: '01-04' },  // BERNAL MOTTA LAURA VALENTINA
    { name: 'LAURA S.', birthdate: '09-28' },  // SANDOVAL SANCHEZ LAURA
    { name: 'LORENZO R.', birthdate: '10-25' },  // RAMOS VARGAS LORENZO
    { name: 'LUCIANO M.', birthdate: '10-05' },  // MOTTA BERNATE LUCIANO
    { name: 'MATIAS F.', birthdate: '05-05' },  // FIERRO JOVEN MATIAS
    { name: 'MIA H.', birthdate: '10-17' },  // HERNANDEZ DUSSAN MIA
    { name: 'PABLO A.', birthdate: '09-29' },  // ALEGRÍA PLAZAS PABLO JOSÉ
    { name: 'PAULA V.', birthdate: '03-13' },  // VICTORIA HERNANDEZ PAULA ANDREA
    { name: 'SAMANTHA C', birthdate: '03-27' },  // CÉSPEDEZ CORTES SAMANTHA
    { name: 'SAMUEL G.', birthdate: '08-09' },  // GUTIERREZ HUELGO SAMUEL
    { name: 'SANTIAGO O.', birthdate: '02-11' },  // OTALORA BARBOSA SANTIAGO ANDRÉS
    { name: 'SARA LUCÍA V.', birthdate: '04-19' },  // VANEGAS TORRES SARA LUCÍA
    { name: 'THOMAS C.', birthdate: '04-11' },  // CERQUERA MONTEALEGRE THOMAS
    { name: 'VALERIA P.', birthdate: '04-21' },  // PEÑA OSORIO VALERIA
];

// Backward-compatible flat array of names for existing tools (birthday planner, etc.)
const studentNames = STUDENTS_DATA.map(s => s.name);

/**
 * CLASS_GROUPS – used by the Turn Tracker for multi-group support.
 * Each entry: { id, label, students: [{ name, birthdate }] }
 *
 * To add a new group: duplicate one of the objects below, give it a
 * unique `id`, update `label`, and fill in the `students` array.
 */
const CLASS_GROUPS = [
    {
        id: '5B',
        label: '5° B',
        students: STUDENTS_DATA,
    },
    {
        id: '5C',
        label: '5° C',
        students: [
            { name: 'SAMUEL C.', birthdate: '01-01' },  // CABREJO SAMUEL
            { name: 'JORGE MARIO', birthdate: '01-01' },
            { name: 'VALERIA R.', birthdate: '01-01' },
            { name: 'ANDRES F.', birthdate: '01-01' },
            { name: 'MARIANA G.', birthdate: '01-01' },
            { name: 'NICOLAS A.', birthdate: '01-01' },
            { name: 'SARA M.', birthdate: '01-01' },
            { name: 'CAMILA B.', birthdate: '01-01' },
            { name: 'JUAN P. L.', birthdate: '01-01' },
            { name: 'ISABELLA P.', birthdate: '01-01' },
            { name: 'DANIEL R.', birthdate: '01-01' },
            { name: 'SOFIA L.', birthdate: '01-01' },
            { name: 'SANTIAGO M.', birthdate: '01-01' },
            { name: 'VALENTINA C.', birthdate: '01-01' },
            { name: 'DAVID O.', birthdate: '01-01' },
            { name: 'ANA PAULA V.', birthdate: '01-01' },
        ],
    },
];
