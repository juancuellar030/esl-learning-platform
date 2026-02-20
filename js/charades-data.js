// ==========================================
// CHARADES GAME DATA
// ESL Learning Platform
// ==========================================

/**
 * Builds charades categories from the existing vocabularyBank
 * plus additional fun categories for young learners.
 */

// --- ESL Vocab categories pulled from vocabularyBank at runtime ---
function buildVocabCategories() {
    const bank = window.vocabularyBank || [];
    const categoryMap = {
        'animals': { label: 'Animals', labelEs: 'Animales', icon: 'fa-solid fa-paw', color: '#4CAF50' },
        'food': { label: 'Food & Drink', labelEs: 'Comida y Bebida', icon: 'fa-solid fa-utensils', color: '#FF9800' },
        'body': { label: 'Body Parts', labelEs: 'Partes del Cuerpo', icon: 'fa-solid fa-person', color: '#E91E63' },
        'clothes': { label: 'Clothes', labelEs: 'Ropa', icon: 'fa-solid fa-shirt', color: '#9C27B0' },
        'sports': { label: 'Sports & Hobbies', labelEs: 'Deportes y Hobbies', icon: 'fa-solid fa-futbol', color: '#2196F3' },
        'weather': { label: 'Weather', labelEs: 'Clima', icon: 'fa-solid fa-cloud-sun', color: '#00BCD4' },
        'places': { label: 'Places', labelEs: 'Lugares', icon: 'fa-solid fa-location-dot', color: '#795548' },
        'transport': { label: 'Transport', labelEs: 'Transporte', icon: 'fa-solid fa-car', color: '#607D8B' },
        'daily-routines': { label: 'Daily Routines', labelEs: 'Rutinas Diarias', icon: 'fa-solid fa-bed', color: '#FF5722' },
        'arts': { label: 'Arts & Crafts', labelEs: 'Arte y Manualidades', icon: 'fa-solid fa-palette', color: '#E040FB' },
        'shapes': { label: 'Shapes', labelEs: 'Figuras', icon: 'fa-solid fa-shapes', color: '#3F51B5' },
        'movement': { label: 'Movement', labelEs: 'Movimiento', icon: 'fa-solid fa-person-running', color: '#F44336' },
        'classroom-language': { label: 'Classroom Language', labelEs: 'Lenguaje del Aula', icon: 'fa-solid fa-chalkboard', color: '#009688' },
    };

    const vocabCategories = {};
    for (const [catKey, meta] of Object.entries(categoryMap)) {
        const words = bank
            .filter(item => item.category === catKey)
            .map(item => ({ word: item.word, spanish: item.spanish || item.word }));
        if (words.length > 0) {
            vocabCategories[catKey] = { ...meta, words };
        }
    }
    return vocabCategories;
}

// --- Fun categories for young learners ---
const funCategories = {
    'movies-characters': {
        label: 'Movies & Characters',
        labelEs: 'Películas y Personajes',
        icon: 'fa-solid fa-wand-magic-sparkles',
        color: '#7B1FA2',
        words: [
            { word: 'Frozen', spanish: 'Frozen' },
            { word: 'Moana', spanish: 'Moana' },
            { word: 'The Lion King', spanish: 'El Rey León' },
            { word: 'Aladdin', spanish: 'Aladino' },
            { word: 'Tangled', spanish: 'Enredados' },
            { word: 'Finding Nemo', spanish: 'Buscando a Nemo' },
            { word: 'Toy Story', spanish: 'Toy Story' },
            { word: 'Coco', spanish: 'Coco' },
            { word: 'Encanto', spanish: 'Encanto' },
            { word: 'The Little Mermaid', spanish: 'La Sirenita' },
            { word: 'Beauty and the Beast', spanish: 'La Bella y la Bestia' },
            { word: 'Cars', spanish: 'Cars' },
            { word: 'Inside Out', spanish: 'Intensamente' },
            { word: 'Monsters Inc', spanish: 'Monsters Inc' },
            { word: 'Ratatouille', spanish: 'Ratatouille' },
            { word: 'Up', spanish: 'Up' },
            { word: 'Brave', spanish: 'Valiente' },
            { word: 'Cinderella', spanish: 'Cenicienta' },
            { word: 'Snow White', spanish: 'Blancanieves' },
            { word: 'Peter Pan', spanish: 'Peter Pan' },
            { word: 'Zootopia', spanish: 'Zootopia' },
            { word: 'Mulan', spanish: 'Mulán' },
            { word: 'Simba', spanish: 'Simba' },
            { word: 'Woody', spanish: 'Woody' },
            { word: 'Minion', spanish: 'Minion' },
            { word: 'Gru', spanish: 'Gru' },
            { word: 'Elsa freezing something', spanish: 'Elsa congelando algo' },
            { word: 'Hiccup riding Toothless', spanish: 'Hipo montando a Chimuelo' },
            { word: 'Shrek', spanish: 'Shrek' },
            { word: 'Puss in Boots', spanish: 'El Gato con Botas' },
        ]
    },
    'countries': {
        label: 'Countries',
        labelEs: 'Países',
        icon: 'fa-solid fa-earth-americas',
        color: '#1976D2',
        words: [
            { word: 'United States', spanish: 'Estados Unidos' },
            { word: 'Mexico', spanish: 'México' },
            { word: 'Colombia', spanish: 'Colombia' },
            { word: 'Brazil', spanish: 'Brasil' },
            { word: 'Argentina', spanish: 'Argentina' },
            { word: 'Spain', spanish: 'España' },
            { word: 'France', spanish: 'Francia' },
            { word: 'England', spanish: 'Inglaterra' },
            { word: 'Italy', spanish: 'Italia' },
            { word: 'Germany', spanish: 'Alemania' },
            { word: 'Japan', spanish: 'Japón' },
            { word: 'China', spanish: 'China' },
            { word: 'India', spanish: 'India' },
            { word: 'Australia', spanish: 'Australia' },
            { word: 'Canada', spanish: 'Canadá' },
            { word: 'Egypt', spanish: 'Egipto' },
            { word: 'South Korea', spanish: 'Corea del Sur' },
            { word: 'Russia', spanish: 'Rusia' },
            { word: 'Peru', spanish: 'Perú' },
            { word: 'Chile', spanish: 'Chile' },
            { word: 'Ecuador', spanish: 'Ecuador' },
            { word: 'Venezuela', spanish: 'Venezuela' },
            { word: 'Portugal', spanish: 'Portugal' },
            { word: 'Greece', spanish: 'Grecia' },
            { word: 'Turkey', spanish: 'Turquía' },
            { word: 'South Africa', spanish: 'Sudáfrica' },
            { word: 'Cuba', spanish: 'Cuba' },
            { word: 'Costa Rica', spanish: 'Costa Rica' },
            { word: 'Panama', spanish: 'Panamá' },
            { word: 'Ireland', spanish: 'Irlanda' },
        ]
    },
    'food-snacks': {
        label: 'Food & Snacks',
        labelEs: 'Comida y Snacks',
        icon: 'fa-solid fa-burger',
        color: '#D32F2F',
        words: [
            { word: 'Hamburger', spanish: 'Hamburguesa' },
            { word: 'French Fries', spanish: 'Papas Fritas' },
            { word: 'Pizza slice', spanish: 'Porción de Pizza' },
            { word: 'Hot Dog', spanish: 'Perro Caliente' },
            { word: 'Chicken Nuggets', spanish: 'Nuggets de Pollo' },
            { word: 'Taco', spanish: 'Taco' },
            { word: 'Burrito', spanish: 'Burrito' },
            { word: 'Milkshake', spanish: 'Malteada' },
            { word: 'Soda', spanish: 'Gaseosa' },
            { word: 'Donut', spanish: 'Dona' },
            { word: 'Popcorn', spanish: 'Palomitas' },
            { word: 'Ice cream cone', spanish: 'Cono de Helado' },
            { word: 'Nachos', spanish: 'Nachos' },
            { word: 'Onion Rings', spanish: 'Aros de Cebolla' },
            { word: 'Pancakes', spanish: 'Panqueques' },
            { word: 'Waffles', spanish: 'Waffles' },
            { word: 'Fried Chicken', spanish: 'Pollo Frito' },
            { word: 'Cotton candy', spanish: 'Algodón de Azúcar' },
            { word: 'Spaghetti', spanish: 'Espaguetis' },
            { word: 'Sushi', spanish: 'Sushi' },
            { word: 'Bubble tea', spanish: 'Té de Burbujas' },
            { word: 'Churro', spanish: 'Churro' },
            { word: 'Chocolate bar', spanish: 'Barra de Chocolate' },
            { word: 'Gummy bears', spanish: 'Ositos de Gomita' },
            { word: 'Lollipop', spanish: 'Paleta' },
            { word: 'Cereal', spanish: 'Cereal' },
            { word: 'Mac and cheese', spanish: 'Macarrones con Queso' },
            { word: 'Peanut butter and jelly', spanish: 'Mantequilla de Maní y Mermelada' },
        ]
    },
    'superheroes-villains': {
        label: 'Superheroes & Villains',
        labelEs: 'Superhéroes y Villanos',
        icon: 'fa-solid fa-mask',
        color: '#C62828',
        words: [
            { word: 'Spider-Man', spanish: 'Hombre Araña' },
            { word: 'Batman', spanish: 'Batman' },
            { word: 'Superman', spanish: 'Superman' },
            { word: 'Wonder Woman', spanish: 'Mujer Maravilla' },
            { word: 'Iron Man', spanish: 'Iron Man' },
            { word: 'Captain America', spanish: 'Capitán América' },
            { word: 'Thor', spanish: 'Thor' },
            { word: 'Hulk', spanish: 'Hulk' },
            { word: 'Black Panther', spanish: 'Pantera Negra' },
            { word: 'The Flash', spanish: 'Flash' },
            { word: 'Deadpool', spanish: 'Deadpool' },
            { word: 'Black Widow', spanish: 'Viuda Negra' },
            { word: 'Doctor Strange', spanish: 'Doctor Strange' },
            { word: 'Green Lantern', spanish: 'Linterna Verde' },
            { word: 'Wolverine', spanish: 'Wolverine' },
            { word: 'Catwoman', spanish: 'Gatúbela' },
            { word: 'A villain laughing', spanish: 'Un villano riendo' },
            { word: 'Putting on a cape', spanish: 'Poniéndose una capa' },
            { word: 'Flying through the city', spanish: 'Volando por la ciudad' },
            { word: 'Thanos snapping his fingers', spanish: 'Thanos chasqueando los dedos' },
            { word: 'The Joker', spanish: 'El Guasón' },
            { word: 'Venom', spanish: 'Venom' },
            { word: 'Magneto', spanish: 'Magneto' },
            { word: 'Loki being sneaky', spanish: 'Loki siendo astuto' },
            { word: 'Shooting spider webs', spanish: 'Lanzando telarañas' },
            { word: 'Throwing a shield', spanish: 'Lanzando un escudo' },
            { word: 'Using laser eyes', spanish: 'Usando rayos láser' },
            { word: 'Turning invisible', spanish: 'Haciéndose invisible' },
            { word: 'Lifting something super heavy', spanish: 'Levantando algo muy pesado' },
            { word: 'Running super fast', spanish: 'Corriendo súper rápido' },
        ]
    },
    'sports-activities': {
        label: 'Sports & Activities',
        labelEs: 'Deportes y Actividades',
        icon: 'fa-solid fa-medal',
        color: '#00897B',
        words: [
            { word: 'Skateboarding', spanish: 'Patinando en tabla' },
            { word: 'Doing a cartwheel', spanish: 'Haciendo una voltereta' },
            { word: 'Playing goalkeeper', spanish: 'Jugando de portero' },
            { word: 'Swimming butterfly stroke', spanish: 'Nadando mariposa' },
            { word: 'Shooting a basketball', spanish: 'Lanzando un balón de baloncesto' },
            { word: 'Rock climbing', spanish: 'Escalando' },
            { word: 'Hula hooping', spanish: 'Haciendo hula hula' },
            { word: 'Surfing a wave', spanish: 'Surfeando una ola' },
            { word: 'Doing a victory dance', spanish: 'Haciendo un baile de victoria' },
            { word: 'Jumping rope', spanish: 'Saltando la cuerda' },
            { word: 'Bowling strike', spanish: 'Chuza en el boliche' },
            { word: 'Swinging a baseball bat', spanish: 'Bateando' },
            { word: 'Riding a horse', spanish: 'Montando a caballo' },
            { word: 'Doing yoga', spanish: 'Haciendo yoga' },
            { word: 'Playing ping pong', spanish: 'Jugando ping pong' },
            { word: 'Fencing', spanish: 'Esgrima' },
            { word: 'Snowboarding', spanish: 'Haciendo snowboard' },
            { word: 'Juggling', spanish: 'Haciendo malabares' },
            { word: 'Archery', spanish: 'Tiro con arco' },
            { word: 'Arm wrestling', spanish: 'Pulseada' },
        ]
    },
    'cartoons': {
        label: 'Cartoons & Shows',
        labelEs: 'Caricaturas',
        icon: 'fa-solid fa-tv',
        color: '#F9A825',
        words: [
            { word: 'SpongeBob', spanish: 'Bob Esponja' },
            { word: 'Peppa Pig', spanish: 'Peppa Pig' },
            { word: 'Paw Patrol', spanish: 'Paw Patrol' },
            { word: 'Tom and Jerry', spanish: 'Tom y Jerry' },
            { word: 'Bluey', spanish: 'Bluey' },
            { word: 'Scooby-Doo', spanish: 'Scooby-Doo' },
            { word: 'Mickey Mouse', spanish: 'Mickey Mouse' },
            { word: 'The Simpsons', spanish: 'Los Simpson' },
            { word: 'Dora the Explorer', spanish: 'Dora la Exploradora' },
            { word: 'Dragon Ball', spanish: 'Dragon Ball' },
            { word: 'Cocomelon', spanish: 'Cocomelon' },
            { word: 'Adventure Time', spanish: 'Hora de Aventura' },
            { word: 'Gravity Falls', spanish: 'Gravity Falls' },
            { word: 'The Powerpuff Girls', spanish: 'Las Chicas Superpoderosas' },
            { word: 'Garfield', spanish: 'Garfield' },
            { word: 'Miraculous Ladybug', spanish: 'Miraculous Ladybug' },
            { word: 'Naruto', spanish: 'Naruto' },
            { word: 'Ben 10', spanish: 'Ben 10' },
            { word: 'Steven Universe', spanish: 'Steven Universe' },
            { word: 'The Fairly OddParents', spanish: 'Los Padrinos Mágicos' },
        ]
    },
    'video-game-characters': {
        label: 'Video Game Characters',
        labelEs: 'Personajes de Videojuegos',
        icon: 'fa-solid fa-gamepad',
        color: '#E64A19',
        words: [
            { word: 'Mario', spanish: 'Mario' },
            { word: 'Luigi', spanish: 'Luigi' },
            { word: 'Pikachu', spanish: 'Pikachu' },
            { word: 'Kirby', spanish: 'Kirby' },
            { word: 'Sonic', spanish: 'Sonic' },
            { word: 'Link', spanish: 'Link' },
            { word: 'Creeper (Minecraft)', spanish: 'Creeper (Minecraft)' },
            { word: 'Among Us crewmate', spanish: 'Tripulante de Among Us' },
            { word: 'Donkey Kong', spanish: 'Donkey Kong' },
            { word: 'Yoshi', spanish: 'Yoshi' },
            { word: 'Toad', spanish: 'Toad' },
            { word: 'Bowser', spanish: 'Bowser' },
            { word: 'Steve (Minecraft)', spanish: 'Steve (Minecraft)' },
            { word: 'Pac-Man', spanish: 'Pac-Man' },
            { word: 'Princess Peach', spanish: 'Princesa Peach' },
            { word: 'Mega Man', spanish: 'Mega Man' },
            { word: 'Crash Bandicoot', spanish: 'Crash Bandicoot' },
            { word: 'Fortnite default dance', spanish: 'Baile de Fortnite' },
            { word: 'Roblox character', spanish: 'Personaje de Roblox' },
            { word: 'Wario', spanish: 'Wario' },
        ]
    },
    'silly-actions': {
        label: 'Everyday Silly Actions',
        labelEs: 'Acciones Locas del Día a Día',
        icon: 'fa-solid fa-face-grin-tears',
        color: '#FF6F00',
        words: [
            { word: 'Stepping on a Lego', spanish: 'Pisar un Lego' },
            { word: 'Trying to sneeze but it won\'t come out', spanish: 'Intentar estornudar pero no sale' },
            { word: 'Brushing hair that\'s way too tangled', spanish: 'Cepillar un pelo muy enredado' },
            { word: 'Missing the school bus', spanish: 'Perder el bus del colegio' },
            { word: 'Tripping over nothing', spanish: 'Tropezar con nada' },
            { word: 'Spilling juice on your shirt', spanish: 'Derramar jugo en tu camisa' },
            { word: 'Forgetting your homework at home', spanish: 'Olvidar la tarea en casa' },
            { word: 'Waking up late for school', spanish: 'Despertarse tarde para el colegio' },
            { word: 'Eating something super spicy', spanish: 'Comer algo muy picante' },
            { word: 'Brain freeze from ice cream', spanish: 'Cerebro congelado por el helado' },
            { word: 'Getting your tongue stuck on something cold', spanish: 'Quedarse con la lengua pegada' },
            { word: 'Walking into a glass door', spanish: 'Chocarse con una puerta de vidrio' },
            { word: 'Waving at someone who wasn\'t waving at you', spanish: 'Saludar a alguien que no te saludaba' },
            { word: 'Trying to open a door the wrong way', spanish: 'Intentar abrir una puerta al revés' },
            { word: 'Sitting on a whoopee cushion', spanish: 'Sentarse en un cojín de pedos' },
            { word: 'Slipping on a banana peel', spanish: 'Resbalarse con una cáscara de banana' },
            { word: 'Getting scared by your own shadow', spanish: 'Asustarse con su propia sombra' },
            { word: 'Trying to catch a fly', spanish: 'Intentar atrapar una mosca' },
            { word: 'Accidentally wearing mismatched socks', spanish: 'Usar medias diferentes sin querer' },
            { word: 'Dropping your phone on your face in bed', spanish: 'Que se te caiga el celular en la cara' },
        ]
    },
    'emojis-emotions': {
        label: 'Emojis & Emotions',
        labelEs: 'Emojis y Emociones',
        icon: 'fa-solid fa-face-laugh-beam',
        color: '#FDD835',
        words: [
            { word: 'Happy', spanish: 'Feliz' },
            { word: 'Sad', spanish: 'Triste' },
            { word: 'Angry', spanish: 'Enojado' },
            { word: 'Scared', spanish: 'Asustado' },
            { word: 'Surprised', spanish: 'Sorprendido' },
            { word: 'Tired', spanish: 'Cansado' },
            { word: 'Excited', spanish: 'Emocionado' },
            { word: 'Bored', spanish: 'Aburrido' },
            { word: 'Nervous', spanish: 'Nervioso' },
            { word: 'Shy', spanish: 'Tímido' },
            { word: 'Proud', spanish: 'Orgulloso' },
            { word: 'Confused', spanish: 'Confundido' },
            { word: 'Silly', spanish: 'Tonto' },
            { word: 'Brave', spanish: 'Valiente' },
            { word: 'Hungry', spanish: 'Hambriento' },
        ]
    }
};

/**
 * Returns all charades categories merged:
 * ESL vocab from vocabularyBank + fun categories
 */
function getAllCharadesCategories() {
    const vocabCats = buildVocabCategories();
    return { ...vocabCats, ...funCategories };
}

// Expose globally
window.getAllCharadesCategories = getAllCharadesCategories;
window.funCategories = funCategories;
