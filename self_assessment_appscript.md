const LOG_SHEET_NAME = 'Hoja 1';

const LOG_HEADERS = [
  'Timestamp',
  'Student Name',
  'Group',
  'C1',
  'C2',
  'C3',
  'C4',
  'C5',
  'C6',
  'C7',
  'C8',
  'C9',
  'Generated Score',
  'Decision',
  'Adjusted Score',
  'Final Score'
];

const ROSTER_HEADERS = [
  'Student Name',
  'Final Score',
  'Generated Score',
  'Decision',
  'Adjusted Score',
  'Submitted At',
  'Attempts',
  'Last Submitted At'
];

const ROSTER = {
  '3A': ['ANDRADE RODRIGUEZ SILVANA', 'BUITRAGO MÉNDEZ JUAN ANDRÉS', 'CABRERA BARRERO JULIETA', 'CAMACHO SALAZAR JULIANA', 'CAMERO PERDOMO JOSÉ MIGUEL', 'CASTAÑEDA RENGIFO ISABELLA', 'CHACÓN RAMÍREZ THOMAS', 'CORTES LOSADA ARIADNA VALENTINA', 'GOMEZ GONZALEZ AARON', 'GRANJA PABÓN THIAGO', 'GUEVARA ORTIZ JUAN ÁLVARO', 'HERNANDEZ CELEITA MARIA ANTONIA', 'MACIAS IBÁÑEZ SAMUEL ANDRÉS', 'MOGOLLÓN RODRÍGUEZ MELISSA', 'NIÑO GALINDO SAMANTHA VICTORIA', 'PATIÑO CLAROS GABRIELA', 'RAMOS MORA VALENTINA ESTRELLITA', 'RIVERA HERRERA MAYTE', 'RUGELES CASTAÑEDA DYLAN THOMAS', 'SAAVEDRA OYOLA EIDER IVAN', 'SÁNCHEZ LUCUARA CELESTE', 'SERRATO MORENO EMILIANO', 'TAMAYO CASTAÑEDA SAMUEL', 'TORRES SARRIA ANTONELLA', 'VÁSQUEZ PEREZ EMILIANO', 'YASNO ÁVILA MATIAS'],
  '3B': ['ARIAS MAJE GABRIEL MATIAS', 'BALLESTEROS COLLAZOS CRISTOBAL', 'BORRERO CORREA ANNIE DANIELA', 'CALDERÓN MORALES EMILIANO', 'CASAS BUITRAGO CELESTE SOFIA', 'CELORIO OVIEDO KILIAN ANDREI', 'CRÍALES MORENO JULIETA', 'DIAZ MEJÍA RONNY ESTIVEN', 'GAITÁN VELÁSQUEZ GABRIELLA', 'GONZALEZ SUAREZ ANA MARIA', 'GRANJA PABÓN IVANNA', 'IBAGON RANGEL EMILY', 'JIMÉNEZ ZAMBRANO FEDERICK', 'MARIN ORDOÑEZ SARA VICTORIA', 'MORA MURCIA JULIÁN FELIPE', 'ORDOÑEZ GUTIÉRREZ MARTIN', 'PATIÑO MARTÍNEZ EDINSON', 'POLANIA BASTIDAS DYLAN SANTIAGO', 'PUENTES DIAZ LUIS ESTEBAN', 'PUENTES REYES EMMANUEL', 'SABI MONJE ANTONELLA', 'SALAZAR DIAZ ANNY MILAGROS', 'SANCHEZ OSPITIA LUCIANA', 'SIERRA MEDINA MATHIAS', 'VARGAS RODRIGUEZ MARIANA', 'VARGAS TRUJILLO EMMANUEL'],
  '3C': ['ACOSTA PARRA SALOMÓN', 'ÁVILA ORTEGA GABRIELA', 'AVILÉS DUSSÁN MATHIAS', 'BARRERO GÓMEZ SANTIAGO', 'BARRETO RAMIREZ NHARA ISABELA', 'BASTOS CÁRDENAS SIMÓN', 'BUITRAGO JAVELA EMMA', 'CALLEJAS SOSA EMILIA', 'CASTILLO ROJAS GABRIELA', 'DIAZ CARVAJAL ARTURO', 'FRANCO DÍAZ ALAN JERÓNIMO', 'JIMÉNEZ BOHADA EMILIANO', 'MEJÍA BORRERO MARIANA', 'MORALES FARFÁN MARTINA', 'OSORIO RUIZ JUAN ANDRÉS', 'ROBLEDO SANTANA SALOME', 'RODRIGUEZ ALVAREZ MARTIN ANDRES', 'ROJAS CLAROS SELENE', 'ROJAS SANDOVAL AVRIL CATALINA', 'SANCHEZ HERNANDEZ ISAAC', 'SANCHEZ LOPEZ DYLAN ARMANDO', 'SILVA BAHAMÓN MANUEL FELIPE', 'SOTELO BRAVO JUAN JOSE', 'TOVAR VARGAS GABRIELA', 'TRIVIÑO GARCÍA YULIANY'],
  '4A': ['ALMARIO URREGO JERONIMO', 'ARISTIZABAL ALVARADO ISABELLA', 'ASTAIZA MONTEALEGRE SALOMÉ', 'BLANCO VANEGAS SAMUEL', 'CALDERÓN RINCÓN SARA', 'CAMAYO CABRERA JUAN ALVARO', 'CARDENAS MONTES SAMUEL', 'CENDALES QUEVEDO JEREMY EITHAN', 'CUELLAR AMAYA MILAN', 'CUELLAR JAVELA JUAN MARTIN', 'DURAN SANCHEZ SALOMÉ', 'FONSECA PEÑA LUCIANA', 'GONZALEZ CORAL NICOLAS', 'GURTIERREZ REYES MANUELA', 'JOAQUI CARDOZO WILLIAM SANTIAGO', 'LEÓN NIÑO SARA MARIA', 'LEYVA GONZALEZ ANA LUCÍA', 'LOPEZ ANDRADE SALOME', 'MUÑOZ RAMON MATHIAS', 'MURCIA ASENCIO SANTIAGO', 'OÑATE SALAMANCA LUCIA', 'ORTIZ CHAVARRO THOMAS FELIPE', 'PEREZ TRUJILLO ALAN MATHIAS', 'PINILLA JIMENEZ SARA VICTORIA', 'REYEZ PEREZ MATHIAS', 'RICARDO CUTA ELIZABETH', 'RUBIANO YARA TOMÁS', 'POLO MURCIA DAVID SANTIAGO', 'SANCHEZ DÍAZ JAIRO ANDRES'],
  '4B': ['ALARCON SABOGAL ANA LUCIA', 'BARRIOS GALINDO SAMUEL', 'BONILLA QUINTERO VALENTINA', 'CALDERON FONSECA JULIANA', 'FANDIÑO CORTES VICTORIA', 'FIERRO QUINTERO ANA SOFÍA', 'FIGUEROA MORENO RAFAEL SANTIAGO', 'GUERRERO MUÑOZ ANGEL GABRIEL', 'JAVELA PLAZAS SAMUEL ANDRES', 'MADRID BONILLA EMANUEL', 'MORA QUIMBAYA THIAGO JULIAN', 'MORENO MONJE TOMAS', 'MOSQUERA ROJAS SALOMÉ', 'MUNAR MOSQUERA JERONIMO', 'MURCIA OCAMPO TOMAS', 'OLAYA IZQUIERDO PALOMA', 'ORTIZ MOLANO GABRIELA', 'PACHECO GAMBOA LUCIANA', 'PARDO VARON EMMANUEL', 'PERDOMO CÓRDOBA JUAN ESTEBAN', 'QUESADA RODRIGUEZ ANTONELLA', 'RIVERA MUÑOZ ABRIL', 'RIVERA ROJAS LUCIANA', 'ROA RAMIREZ ANA SOFÍA', 'SASTOQUE VILLARREAL JOSÉ DAVID', 'TRILLERAS RINCON JUAN PABLO', 'TRUJILLO RIVERA ANA VICTORIA', 'URRIAGO ANDRADE CELESTE', 'VASQUEZ RAMIREZ SANTIAGO'],
  '4C': ['ALEGRÍA PLAZAS PABLO JOSÉ', 'BERNAL MOTTA LAURA VALENTINA', 'CABRERA MENDEZ ANAMARIA', 'CARRILLO GOMEZ ALEJANDRO', 'CASTRO LEYTON BRIANA ALETH', 'CELORIO OVIEDO KESHIA CAROLINA', 'CERQUERA MONTEALEGRE TOMÁS', 'CÉSPEDES CORTES SAMANTHA', 'FIERRO JOVEN MATIAS', 'GUTIERREZ HUELGO SAMUEL', 'HERNANDEZ DUSSAN MIA', 'HUERTAS JAIMES ALEJANDRA', 'LUNA CALDERON JUANA VICTORIA', 'MOTTA BERNATE LUCIANO', 'OTALORA BARBOSA SANTIAGO ANDRÉS', 'PATIÑO RICO DANIEL', 'PEÑA OSORIO VALERIA', 'PENNA LAISECA ANTONELLA', 'PEREZ LOPEZ EVA MARIA', 'PORTILLA BENITEZ DANNA', 'QUIROZ GARCIA EMILIANO', 'RAMOS VARGAS LORENZO', 'RENDON CUELLAR EMILIO', 'RIOS SERRATO JUAN JOSÉ', 'RODRIGUEZ SARRIAS JUAN JOSÉ', 'SANDOVAL SANCHEZ LAURA', 'TAMAYO TORRES EMILIANO', 'VANEGAS TORRES SARA LUCÍA', 'VICTORIA HERNANDEZ PAULA ANDREA', 'VIEDA DIAZ ERMES SANTIAGO'],
  '5A': ['ARISTIZABAL RINCÓN MARÍA JOSÉ', 'ARTUNDUAGA PASTRANA MARIANA', 'BARREIRO GARCÍA SANTIAGO', 'BARRETO DUSSAN MARTÍN', 'BONILLA QUIROGA ANA SOFIA', 'BONILLA RAMIREZ JHON FREDY', 'CAMACHO SALAZAR THALIANA', 'CARDENAS TOVAR DANIEL MATHIAS', 'CEDEÑO CEDEÑO ISABELLA', 'CUELLAR CELIS EMILIANO', 'DÍAZ MEJÍA MARÍA CELESTE', 'DÍAZ RODRIGUEZ CELESTE', 'DUSSÁN ROJAS ORALIS ARIANA', 'GONZÁLEZ FERNÁNDEZ ÁNGEL GABRIEL', 'GONZALEZ SUAREZ LUCIANA CELESTE', 'HERNÁNDEZ ZEA SAMUEL', 'HUESO HERNANDEZ JOSE ALEJANDRO', 'LUGO SILVA DALIANA LUCIA', 'PERDOMO HERRERA SAMUEL', 'PERLAZA MEDINA SAMUEL JOSÉ', 'PINZÓN NÁRVAEZ SARA VALENTINA', 'POLANCO VEGA EMMANUEL', 'SANCHEZ DONATO THALYA', 'SILVA CABRERA JOSÉ DAVID', 'TELLO PERÉZ GUADALUPE', 'URREA VANEGAS SANTIAGO', 'VARGAS TRUJILLO SIMON ALFREDO', 'VARGAS VASQUEZ DYLAN SAMUEL'],
  '5B': ['ACERO SOTO DANNA SOFIA', 'AGUIRRE POLANIA MARTHA LUCIA', 'AGUIRRE SANTOFIMIO GABRIELA', 'ANDRADE TAMAYO ANA ISABEL', 'AREVALO GONZALEZ ANGELA MARÍA', 'CHACÓN RUJANA ZAHIRA SOFÍA', 'CLAROS AGUDELO ARIADNA CLAROS', 'ESPINOSA BUSTACARA ANA ISABELLA', 'ESQUIVEL MOSQUERA ANTONELLA', 'GUIO QUINTERO JUAN PABLO', 'HERNANDEZ PINEDA JULIAN DAVID', 'MEJÍA BORRERO JUAN ESTEBAN', 'MONJE ORDOÑEZ MARÍA VICTORIA', 'MOSQUERA BAYLÓN KEVIN SAMUEL', 'OBREGÓN SÁNCHEZ JUAN MARTÍN', 'ORTEGA CORTÉS NICOLL MARIANA', 'ORTIZ GONZÁLEZ RAFAEL THOMAS', 'PALACIOS SANCHÉZ MARÍA ANTONIA', 'PARRA VITOVIZ NICOLAS MAURICIO', 'PERDOMO GRAFFE LUCIANA', 'PINCHAO VALENZUELA MARTÍN', 'ROJAS PAYAN GABRIEL DAVID', 'SORA ORTIZ JERÓNIMO', 'TOVAR BAHAMÓN SAMUEL DAVID', 'TRUJILLO TORREJANO LENIN SANTIAGO', 'VERGARA MOLANO JUAN FELIPE', 'VILLARREAL BASTIDAS IANN SANTIAGO', 'ZORRO FERNÁNDEZ SALOMÉ'],
  '5C': ['CABREJO GONZÁLEZ SAMUEL', 'CARDENAS RODIGUEZ EDUARD SANTIAGO', 'CHINCHILLA RÍOS VIOLETTA', 'CLAVIJO PERDOMO EMMA', 'CORREDOR AROCA MATÍAS', 'CUBILLOS CAMACHO VALERIA', 'DÍAZ SONS ANGEL MARTÍN', 'DUSSAN LEMUS JULIETA', 'GAITÁN VARGAS ANA LUCÍA', 'ICOPO MELENDEZ LUCAS ANDRÉS', 'JARA ALDANA MARTÍN', 'MEDINA OBANDO DAVID ESTEBAN', 'MOLINA LOZADA SAMANTHA', 'ORTIGOZA GÓMEZ MIA SALOMÉ', 'PACHECO PEREZ GABRIEL ALEJANDRO', 'PALOMINO HERNÁNDEZ MARTÍN', 'PÉREZ NIÑO ABRIL', 'PINEDA UNÍ EMMANUEL', 'PRECIADO CUERVO ISABELLA', 'PUENTES SUAREZ GINA MARCELA', 'RAMÍREZ SALCEDO JUAN ANDRÉS', 'RAMIREZ YEPEZ LUCIA', 'RENGIFO OTALORA JUANA VALERIA', 'RINCÓN MEDINA SAMUEL NICOLÁS', 'ROMERO TAMAYO EMILY LUCIANA', 'VALENCIA PACHECO JORGE MARÍO', 'VELEZ GOMEZ MIGUEL ANGEL', 'ZAPATA SALAZAR JUAN ANDRÉS'],
  '5D': ['ALMARIO GAMBOA DANTE', 'ALVARADO GÓMEZ JERÓNIMO', 'ALVIRA CHARRY JUAN SEBASTIÁN', 'ÁNGEL PERDOMO THIAGO EMMANUEL', 'CAMACHO GARCÍA DIEGO ANDRÉS', 'CARVAJAL PLAZA LUCIANA', 'CONTRERAS GARCÍA ANALUCIA', 'CORTES TRUJILLO JERONIMO', 'DÍAZ POLANIA GABRIELA', 'FAJARDO CASTAÑEDA MARÍA PAZ', 'FORTALECHE POLANIA SARA DAILY', 'GUTIERREZ DUSSÁN SARA VALENTINA', 'HERRERA LEÓN AMÉRICA ISABELA', 'MAYOR MOTTA JERÓNIMO', 'MENESES TEJADA JULIETA MARÍA', 'ORDOÑEZ GÓMEZ JUAN JOSÉ', 'OYOLA CUTIVA JOSE ALEJANDRO', 'PERALTA MEDINA SALOME', 'PINO ALARCÓN SANTIAGO', 'PUENTES DÍAZ ADRIAN FELIPE', 'PULIDO LOSADA JUAN JOSE', 'RIVERA DÍAZ ANA SOFIA', 'RUBIANO ORTIZ DANTE', 'SÁNCHEZ HERNÁNDEZ SALOMÉ', 'SUAZA FAJARDO ISABELLA', 'TAMAYO ALVARADO EMILIANO', 'TRUJILLO MONTEALEGRE ISABELLA', 'VARGAS ZAPATA ADRIAN EDUARDO']
};

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const data = JSON.parse(e.postData.contents);
    const finalScore = getFinalScore(data);
    const decision = data.decision === 'agree' ? 'De acuerdo' : 'En desacuerdo';
    const timestamp = data.timestamp || new Date().toISOString();

    if (!ROSTER[data.group]) {
      return createJsonResponse({ result: 'error', error: 'Grupo no reconocido: ' + data.group });
    }
    if (ROSTER[data.group].indexOf(data.name) === -1) {
      return createJsonResponse({ result: 'error', error: 'Estudiante no encontrado en el grupo: ' + data.name });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = getOrCreateLogSheet(ss);
    appendLogRow(logSheet, data, decision, finalScore, timestamp);

    const groupSheet = getOrCreateGroupSheet(ss, data.group);
    const row = findStudentRow(groupSheet, data.name);
    const currentAttempts = Number(groupSheet.getRange(row, 7).getValue()) || 0;
    const attempts = currentAttempts + 1;
    groupSheet.getRange(row, 2, 1, 7).setValues([[
      finalScore,
      data.generatedScore || '',
      decision,
      data.adjustedScore !== null && data.adjustedScore !== undefined ? data.adjustedScore : '',
      timestamp,
      attempts,
      timestamp
    ]]);

    return createJsonResponse({
      result: 'success',
      group: data.group,
      student: data.name,
      row,
      finalScore
    });
  } catch (error) {
    return createJsonResponse({ result: 'error', error: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

function getFinalScore(data) {
  if (data.decision === 'disagree' && data.adjustedScore !== null && data.adjustedScore !== undefined && data.adjustedScore !== '') {
    return data.adjustedScore;
  }
  return data.generatedScore;
}

function getOrCreateLogSheet(ss) {
  let sheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(LOG_SHEET_NAME);
  if (sheet.getRange(1, 1).getValue() !== LOG_HEADERS[0]) {
    sheet.clear();
    sheet.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]);
    formatHeader(sheet, LOG_HEADERS.length);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function appendLogRow(sheet, data, decision, finalScore, timestamp) {
  sheet.appendRow([
    timestamp,
    data.name,
    data.group,
    data.answers && data.answers.c1 ? data.answers.c1 : '',
    data.answers && data.answers.c2 ? data.answers.c2 : '',
    data.answers && data.answers.c3 ? data.answers.c3 : '',
    data.answers && data.answers.c4 ? data.answers.c4 : '',
    data.answers && data.answers.c5 ? data.answers.c5 : '',
    data.answers && data.answers.c6 ? data.answers.c6 : '',
    data.answers && data.answers.c7 ? data.answers.c7 : '',
    data.answers && data.answers.c8 ? data.answers.c8 : '',
    data.answers && data.answers.c9 ? data.answers.c9 : '',
    data.generatedScore || '',
    decision,
    data.adjustedScore !== null && data.adjustedScore !== undefined ? data.adjustedScore : '',
    finalScore
  ]);
}

function getOrCreateGroupSheet(ss, group) {
  let sheet = ss.getSheetByName(group);
  if (!sheet) sheet = ss.insertSheet(group);
  setupGroupSheet(sheet, group);
  return sheet;
}

function setupGroupSheet(sheet, group) {
  const students = ROSTER[group] || [];
  const headerIsReady = sheet.getRange(1, 1).getValue() === ROSTER_HEADERS[0];
  if (!headerIsReady) {
    sheet.clear();
    sheet.getRange(1, 1, 1, ROSTER_HEADERS.length).setValues([ROSTER_HEADERS]);
    if (students.length) {
      sheet.getRange(2, 1, students.length, 1).setValues(students.map(name => [name]));
    }
    formatHeader(sheet, ROSTER_HEADERS.length);
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 280);
    for (let col = 2; col <= ROSTER_HEADERS.length; col++) sheet.setColumnWidth(col, 120);
    return;
  }

  ensureRosterHeaders(sheet);

  const existingNames = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat()
    : [];
  const missing = students.filter(name => existingNames.indexOf(name) === -1);
  if (missing.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, missing.length, 1).setValues(missing.map(name => [name]));
  }
}

function ensureRosterHeaders(sheet) {
  const existingHeaderCount = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, existingHeaderCount).getValues()[0];

  ROSTER_HEADERS.forEach((header, index) => {
    if (headers[index] !== header) {
      sheet.getRange(1, index + 1).setValue(header);
    }
  });

  formatHeader(sheet, ROSTER_HEADERS.length);
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 280);
  for (let col = 2; col <= ROSTER_HEADERS.length; col++) sheet.setColumnWidth(col, 120);
}

function findStudentRow(sheet, studentName) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('No hay estudiantes en la hoja ' + sheet.getName());
  const names = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const index = names.indexOf(studentName);
  if (index === -1) throw new Error('No se encontró al estudiante en la hoja: ' + studentName);
  return index + 2;
}

function formatHeader(sheet, columnCount) {
  sheet.getRange(1, 1, 1, columnCount)
    .setBackground('#3d348b')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
}

function setupRosterSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  getOrCreateLogSheet(ss);
  Object.keys(ROSTER).forEach(group => getOrCreateGroupSheet(ss, group));
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}