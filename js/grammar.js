// Grammar Module
const GrammarModule = {
    currentGrammar: null,
    inkController: null,

    // Constants for Brave-style Toolbar
    BRUSH_SIZES: {
        PEN: [
            { size: 4, icon: 'circle', scale: 0.5 },
            { size: 6, icon: 'circle', scale: 0.7 },
            { size: 8, icon: 'circle', scale: 0.9 },
            { size: 12, icon: 'circle', scale: 1.1 }
        ],
        HIGHLIGHTER: [
            { size: 16, icon: 'square', scale: 0.6 },
            { size: 24, icon: 'square', scale: 0.8 },
            { size: 32, icon: 'square', scale: 1.0 },
            { size: 48, icon: 'square', scale: 1.2 }
        ],
        TEXT: [
            { size: 16, icon: 'font', scale: 0.8 },
            { size: 20, icon: 'font', scale: 1.0 },
            { size: 24, icon: 'font', scale: 1.2 },
            { size: 32, icon: 'font', scale: 1.4 }
        ]
    },

    // Softer Palette
    BRUSH_COLORS: [
        { color: '#2c3e50', label: 'Charcoal' },
        { color: '#e57373', label: 'Soft Red' },
        { color: '#81c784', label: 'Soft Green' },
        { color: '#64b5f6', label: 'Soft Blue' },
        { color: '#ffb74d', label: 'Soft Orange' }
    ],

    HIGHLIGHTER_COLORS: [
        { color: '#ffcdd2', label: 'Light Red' },
        { color: '#fff9c4', label: 'Light Yellow' },
        { color: '#c8e6c9', label: 'Light Green' },
        { color: '#b2ebf2', label: 'Light Cyan' },
        { color: '#bbdefb', label: 'Light Blue' },
        { color: '#e1bee7', label: 'Light Purple' }
    ],

    init() {
        this.renderGrammarList();
        this.setupEventListeners();
    },

    renderGrammarList(category = 'all', level = 'all') {
        const list = document.getElementById('grammar-list');
        let rules = window.grammarBank;

        if (category !== 'all') {
            rules = rules.filter(g => g.category === category);
        }
        if (level !== 'all') {
            rules = rules.filter(g => g.level === level);
        }

        list.innerHTML = rules.map(grammar => `
            <div class="grammar-card" data-id="${grammar.id}">
                <h4>${grammar.rule}</h4>
                <p>${grammar.explanation.substring(0, 100)}...</p>
                <div class="grammar-meta">
                    <span>${grammar.category}</span>
                    <span class="level-tag ${grammar.level}">${grammar.level}</span>
                </div>
            </div>
        `).join('');

        // Add click handlers
        document.querySelectorAll('.grammar-card').forEach(card => {
            card.addEventListener('click', () => {
                this.showGrammarLesson(card.dataset.id);
            });
        });
    },

    showGrammarLesson(grammarId) {
        const grammar = window.grammarBank.find(g => g.id === grammarId);
        if (!grammar) return;

        this.currentGrammar = grammar;

        const container = document.getElementById('grammar-lesson-container');

        let contentHtml = '';

        if (grammar.rule === 'May vs. Might') {
            contentHtml = `
                <div class="grammar-infographic-card">
                    <header class="grammar-infographic-header">
                        <div class="grammar-badge">
                            <i class="fa-solid fa-scale-balanced" style="font-size: 24px; margin-bottom: 5px;"></i><br>
                            Modal Verbs
                        </div>
                        <h1 class="grammar-infographic-title">May <span style="color: var(--medium-slate-blue); font-size: 0.6em; vertical-align: middle;">vs</span> Might</h1>
                    </header>

                    <div class="grammar-content-grid">
                        <!-- Left Column -->
                        <section class="left-col">
                            <div class="grammar-uses-title">Common Uses</div>

                            <div class="grammar-example-item">
                                <div class="grammar-category-tag">Possibility</div>
                                <p class="grammar-example-text">It <b>might</b> rain later, so take an umbrella.</p>
                            </div>

                            <div class="grammar-example-item">
                                <div class="grammar-category-tag">Give Permission</div>
                                <p class="grammar-example-text">You <b>may</b> have another cookie if you like.</p>
                            </div>

                            <div class="grammar-example-item">
                                <div class="grammar-category-tag">Ask Permission</div>
                                <p class="grammar-example-text"><b>May</b> I borrow your pen please?</p>
                            </div>

                            <div class="grammar-example-item">
                                <div class="grammar-category-tag">Wishes</div>
                                <p class="grammar-example-text"><b>May</b> the New Year bring you happiness.</p>
                            </div>

                            <div class="grammar-example-item">
                                <div class="grammar-category-tag">Past Speculation</div>
                                <p class="grammar-example-text">She is late. She <b>may</b> have missed her plane.</p>
                            </div>
                        </section>

                        <!-- Right Column -->
                        <section class="right-col">
                            <div class="grammar-comparison-box">
                                <div class="grammar-comp-header"><i class="fa-regular fa-lightbulb"></i> Quick Tip</div>
                                <p class="grammar-comp-text">
                                    <b>May</b> and <b>Might</b> are often interchangeable for possibility, but there is a slight difference in certainty:
                                </p>
                                <div class="grammar-probability-chart">
                                    <div class="prob-row">
                                        <span class="prob-label">May</span>
                                        <div class="prob-bar" style="width: 70%;"></div>
                                        <span class="prob-val">~70%</span>
                                    </div>
                                    <div class="prob-row">
                                        <span class="prob-label">Might</span>
                                        <div class="prob-bar" style="width: 40%; background: var(--amber-flame);"></div>
                                        <span class="prob-val">~40%</span>
                                    </div>
                                </div>
                                <p class="grammar-comp-text" style="margin-top: 15px; font-size: 0.9em; opacity: 0.8;">
                                    *Only <b>May</b> is used for formal permission or wishes.
                                </p>
                            </div>

                            <div style="margin-top: 20px; padding: 15px; background: var(--indigo-velvet); color: white; border-radius: 12px; text-align: center;">
                                <h4 style="margin: 0 0 10px 0; color: var(--amber-flame);"><i class="fa-solid fa-gamepad"></i> Interactive Practice</h4>
                                <p style="font-size: 0.9rem; margin-bottom: 15px;">Unjumble the sentences to practice May and Might!</p>
                                <button class="btn-primary" onclick="window.open('practice.html?mode=may-might-unjumble', '_blank')" style="background: var(--amber-flame); color: var(--indigo-velvet); border: none; font-weight: 800; width: 100%; cursor: pointer;">
                                    <i class="fa-solid fa-play"></i> PLAY UNJUMBLE GAME
                                </button>
                            </div>
                        </section>
                    </div>
                </div>
            `;
        } else if (grammar.rule === 'Indefinite Pronouns') {
            contentHtml = `
                <div class="grammar-infographic-card">
                    <header class="grammar-infographic-header">
                        <div class="grammar-badge">
                            <i class="fa-solid fa-users" style="font-size: 24px; margin-bottom: 5px;"></i><br>
                            Pronouns
                        </div>
                        <h1 class="grammar-infographic-title" style="font-size: 2.8rem;">Indefinite Pronouns</h1>
                    </header>

                    <div class="grammar-content-grid">
                        <!-- Left Column -->
                        <section class="left-col">
                            <div class="grammar-uses-title">How to Use Them</div>
                            <p class="grammar-intro-text" style="margin-bottom: 20px; font-style: italic;">
                                We use indefinite pronouns to talk about a place, person or thing without saying which one.
                            </p>

                            <div class="grammar-example-item">
                                <div class="grammar-category-tag">Every- (All)</div>
                                <p class="grammar-example-text">Luca ate <b>everything</b> on his plate.</p>
                            </div>

                            <div class="grammar-example-item">
                                <div class="grammar-category-tag">Some- (One)</div>
                                <p class="grammar-example-text">We should eat <b>something</b> before we go out.</p>
                            </div>

                            <div class="grammar-example-item">
                                <div class="grammar-category-tag">Any- (? / -)</div>
                                <p class="grammar-example-text">Are you hungry? Would you like <b>anything</b> to eat?</p>
                            </div>

                            <div class="grammar-example-item">
                                <div class="grammar-category-tag">No- (None)</div>
                                <p class="grammar-example-text">There's <b>nothing</b> to eat at home.</p>
                            </div>
                        </section>

                        <!-- Right Column -->
                        <section class="right-col">
                            <div class="grammar-comparison-box">
                                <div class="grammar-comp-header"><i class="fa-solid fa-table"></i> Quick Reference</div>
                                <p class="grammar-comp-text" style="margin-bottom: 15px;">
                                    Combine <b>prefixes</b> with <b>suffixes</b>:
                                </p>
                                <p style="font-size: 0.9rem; margin-bottom: 15px; opacity: 0.9; font-style: italic;">
                                    -where (places), -thing (things), -one (people)
                                </p>
                                
                                <div class="grammar-table-wrapper" style="overflow-x: auto;">
                                    <table class="grammar-reference-table" style="width: 100%; border-collapse: collapse; color: white; text-align: center;">
                                        <thead>
                                            <tr style="border-bottom: 2px solid rgba(255,255,255,0.2);">
                                                <th style="padding: 10px;"></th>
                                                <th style="padding: 10px; color: var(--amber-flame);">all</th>
                                                <th style="padding: 10px; color: #81c784;">+</th>
                                                <th style="padding: 10px; color: #64b5f6;">- / ?</th>
                                                <th style="padding: 10px; color: #e57373;">-</th>
                                            </tr>
                                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                                                <th style="padding: 10px;"></th>
                                                <th style="padding: 10px; font-weight: 400;">every</th>
                                                <th style="padding: 10px; font-weight: 400;">some</th>
                                                <th style="padding: 10px; font-weight: 400;">any</th>
                                                <th style="padding: 10px; font-weight: 400;">no</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                                                <td style="padding: 10px; font-weight: 700; color: var(--amber-flame);">where</td>
                                                <td style="padding: 10px;">everywhere</td>
                                                <td style="padding: 10px;">somewhere</td>
                                                <td style="padding: 10px;">anywhere</td>
                                                <td style="padding: 10px;">nowhere</td>
                                            </tr>
                                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                                                <td style="padding: 10px; font-weight: 700; color: var(--amber-flame);">thing</td>
                                                <td style="padding: 10px;">everything</td>
                                                <td style="padding: 10px;">something</td>
                                                <td style="padding: 10px;">anything</td>
                                                <td style="padding: 10px;">nothing</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 10px; font-weight: 700; color: var(--amber-flame);">one</td>
                                                <td style="padding: 10px;">everyone</td>
                                                <td style="padding: 10px;">someone</td>
                                                <td style="padding: 10px;">anyone</td>
                                                <td style="padding: 10px;">no-one</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                
                                <div style="margin-top: 20px; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 10px; font-style: italic; font-size: 0.95em; text-align: center; border-left: 4px solid var(--amber-flame);">
                                    "Everyone should come to the circus!"
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            `;
        } else if (grammar.rule === 'Telling the Time') {
            contentHtml = `
                <div class="grammar-infographic-card">
                    <header class="grammar-infographic-header">
                        <div class="grammar-badge">
                            <i class="fa-solid fa-clock" style="font-size: 24px; margin-bottom: 5px;"></i><br>
                            Time
                        </div>
                        <h1 class="grammar-infographic-title">Telling the Time</h1>
                    </header>

                    <div class="grammar-content-grid">
                        <!-- Left Column: The Clock -->
                        <section class="left-col" style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                            <div class="grammar-uses-title">The Clock Face</div>
                            
                            <div class="time-clock-container" style="position: relative; width: 280px; height: 280px; border: 10px solid var(--indigo-velvet); border-radius: 50%; background: white; margin: 20px 0; box-shadow: 0 5px 15px rgba(0,0,0,0.1);">
                                <!-- To / Past Sides -->
                                <div style="position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; background: rgba(0,0,0,0.1);"></div>
                                <div style="position: absolute; left: 70%; top: 20%; color: var(--medium-slate-blue); font-weight: 800; font-size: 1.2rem;">PAST</div>
                                <div style="position: absolute; left: 15%; top: 20%; color: #e57373; font-weight: 800; font-size: 1.2rem;">TO</div>

                                <!-- Clock Markers -->
                                <div style="position: absolute; left: 50%; top: 5px; transform: translateX(-50%); font-weight: 700;">o'clock</div>
                                <div style="position: absolute; right: 15px; top: 50%; transform: translateY(-50%); font-weight: 700;">quarter past</div>
                                <div style="position: absolute; left: 50%; bottom: 5px; transform: translateX(-50%); font-weight: 700;">half past</div>
                                <div style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); font-weight: 700;">quarter to</div>

                                <!-- Hands (Static Example) -->
                                <div style="position: absolute; left: 50%; top: 50%; width: 4px; height: 80px; background: var(--indigo-velvet); transform-origin: bottom center; transform: translate(-50%, -100%) rotate(0deg); border-radius: 4px;"></div>
                                <div style="position: absolute; left: 50%; top: 50%; width: 6px; height: 60px; background: var(--medium-slate-blue); transform-origin: bottom center; transform: translate(-50%, -100%) rotate(90deg); border-radius: 4px;"></div>
                                <div style="position: absolute; left: 50%; top: 50%; width: 12px; height: 12px; background: var(--amber-flame); border-radius: 50%; transform: translate(-50%, -50%); border: 2px solid white;"></div>
                            </div>

                            <div style="width: 100%; text-align: left; background: #f0f4ff; padding: 15px; border-radius: 12px; border-left: 5px solid var(--medium-slate-blue);">
                                <p style="margin: 0; font-weight: 700; color: var(--indigo-velvet);">Rule:</p>
                                <ul style="margin: 5px 0 0 20px; padding: 0; font-size: 0.95rem;">
                                    <li><b>Past</b>: Minutes 1 to 30</li>
                                    <li><b>To</b>: Minutes 31 to 59</li>
                                    <li><b>At + Time</b>: For specific events</li>
                                </ul>
                            </div>
                        </section>

                        <!-- Right Column: List -->
                        <section class="right-col">
                            <div class="grammar-comparison-box" style="background: white; border: 2px solid var(--indigo-velvet); color: #333;">
                                <div class="grammar-comp-header" style="color: var(--indigo-velvet);"><i class="fa-solid fa-list-ol"></i> Examples (2:00 - 2:55)</div>
                                
                                <div class="time-examples-list" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.9rem;">
                                    <div style="padding: 5px; border-bottom: 1px solid #eee;">2:00 - <b>o'clock</b></div>
                                    <div style="padding: 5px; border-bottom: 1px solid #eee;">2:30 - <b>half past</b></div>
                                    <div style="padding: 5px; border-bottom: 1px solid #eee;">2:05 - <b>five past</b></div>
                                    <div style="padding: 5px; border-bottom: 1px solid #eee;">2:35 - <b>twenty-five to</b></div>
                                    <div style="padding: 5px; border-bottom: 1px solid #eee;">2:10 - <b>ten past</b></div>
                                    <div style="padding: 5px; border-bottom: 1px solid #eee;">2:40 - <b>twenty to</b></div>
                                    <div style="padding: 5px; border-bottom: 1px solid #eee;">2:15 - <b>quarter past</b></div>
                                    <div style="padding: 5px; border-bottom: 1px solid #eee;">2:45 - <b>quarter to</b></div>
                                    <div style="padding: 5px; border-bottom: 1px solid #eee;">2:20 - <b>twenty past</b></div>
                                    <div style="padding: 5px; border-bottom: 1px solid #eee;">2:50 - <b>ten to</b></div>
                                    <div style="padding: 5px; border-bottom: 1px solid #eee;">2:25 - <b>twenty-five past</b></div>
                                    <div style="padding: 5px; border-bottom: 1px solid #eee;">2:55 - <b>five to</b></div>
                                </div>

                                <div style="margin-top: 20px; padding: 15px; background: var(--indigo-velvet); color: white; border-radius: 12px; text-align: center; pointer-events: auto;">
                                    <h4 style="margin: 0 0 10px 0; color: var(--amber-flame);"><i class="fa-solid fa-gamepad"></i> Interactive Practice</h4>
                                    <p style="font-size: 0.9rem; margin-bottom: 15px;">Test your knowledge with the Listening Time Quiz!</p>
                                    <button class="btn-primary" onclick="window.open('practice.html?mode=time-quiz', '_blank')" style="background: var(--amber-flame); color: var(--indigo-velvet); border: none; font-weight: 800; width: 100%; cursor: pointer;">
                                        <i class="fa-solid fa-play"></i> PLAY TIME QUIZ
                                    </button>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            `;
        } else {
            contentHtml = `
                <div style="background: white; padding: 30px; border-radius: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                    <h3 style="color: var(--indigo-velvet); margin-top: 0;">${grammar.rule}</h3>
                    <p style="font-size: 1.1rem; line-height: 1.6;">${grammar.explanation}</p>
                    ${grammar.image ? `<img src="${grammar.image}" style="max-width: 100%; margin-top: 20px; border-radius: 10px;">` : ''}
                </div>
            `;
        }

        container.innerHTML = `
            <div class="grammar-lesson-wrapper" style="position: relative;">
                <div class="lesson-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 id="grammar-title" style="margin: 0; font-size: 2rem; color: var(--indigo-velvet);">${grammar.rule}</h3>
                    <button class="btn-secondary" id="toggle-annotation-btn">
                        <i class="fa-solid fa-pen-to-square"></i> Annotate
                    </button>
                </div>

                <!-- Brave Style Toolbar -->
                <div id="annotation-toolbar" class="brave-annotation-toolbar" style="display: none;">
                    <button class="brave-tool-btn active" data-tool="pen" title="Pen">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="brave-tool-btn" data-tool="highlighter" title="Highlighter">
                        <i class="fa-solid fa-highlighter"></i>
                    </button>
                    <button class="brave-tool-btn" data-tool="text" title="Text">
                        <i class="fa-solid fa-font"></i>
                    </button>
                    <button class="brave-tool-btn" data-tool="eraser" title="Eraser">
                        <i class="fa-solid fa-eraser"></i>
                    </button>
                    
                    <div class="brave-separator"></div>

                    <!-- Size Dropdown -->
                    <div class="brave-dropdown">
                        <button class="brave-tool-btn" id="size-dropdown-btn" title="Size">
                            <span id="current-size-indicator" style="width: 8px; height: 8px; background: currentColor; border-radius: 50%;"></span>
                        </button>
                        <div class="brave-dropdown-content" id="size-dropdown-content">
                            <div class="brave-size-selector" id="size-selector">
                                <!-- Populated by JS -->
                            </div>
                        </div>
                    </div>

                    <!-- Color Dropdown -->
                    <div class="brave-dropdown">
                        <button class="brave-tool-btn" id="color-dropdown-btn" title="Color">
                            <span id="current-color-indicator" style="width: 16px; height: 16px; background: #000; border-radius: 50%;"></span>
                        </button>
                        <div class="brave-dropdown-content" id="color-dropdown-content">
                            <div class="brave-color-grid" id="color-selector">
                                <!-- Populated by JS -->
                            </div>
                        </div>
                    </div>

                    <div class="brave-separator"></div>

                    <button class="brave-tool-btn" id="clear-annotation-btn" title="Clear All">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>

                <div class="grammar-content-wrapper" id="grammar-content-wrapper" style="position: relative; transition: border-color 0.3s; border: 2px solid transparent; border-radius: 12px; margin-top: 10px;">
                    <div id="grammar-html-content">
                        ${contentHtml}
                    </div>
                    <!-- Note: Pointer events on HTML content disabled when annotating so strokes don't select text -->
                    
                    <canvas id="grammar-canvas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10;"></canvas>
                </div>

                <div class="grammar-content" style="margin-top: 20px;">
                    <div class="grammar-examples" id="grammar-examples">
                        <h4>Examples</h4>
                        <ul>
                            ${grammar.examples.map(ex => `<li>${ex}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="grammar-mistakes" id="grammar-mistakes">
                        <h4>Common Mistakes</h4>
                        <ul>
                            ${grammar.commonMistakes.map(m => `<li>${m}</li>`).join('')}
                        </ul>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 30px;">
                    <button class="btn-primary" id="generate-grammar-exercise">Generate Exercises</button>
                </div>
            </div>
            <div id="grammar-exercise-display"></div>
        `;

        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth' });

        // Re-attach event listeners
        document.getElementById('generate-grammar-exercise').addEventListener('click', () => {
            this.generateExercises();
        });

        document.getElementById('toggle-annotation-btn').addEventListener('click', () => {
            this.toggleAnnotationMode();
        });

        // Initialize Ink Controller
        this.inkController = new InkController('grammar-canvas', 'grammar-content-wrapper');
        this.initToolbar();
    },

    initToolbar() {
        const toolbar = document.getElementById('annotation-toolbar');
        const sizeDropdownBtn = document.getElementById('size-dropdown-btn');
        const sizeDropdownContent = document.getElementById('size-dropdown-content');
        const colorDropdownBtn = document.getElementById('color-dropdown-btn');
        const colorDropdownContent = document.getElementById('color-dropdown-content');

        // Tool Selection
        toolbar.querySelectorAll('[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                toolbar.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.inkController.setTool(btn.dataset.tool);
                this.updateSizeSelector();
                this.updateColorSelector();
            });
        });

        // Dropdowns
        sizeDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sizeDropdownContent.classList.toggle('show');
            colorDropdownContent.classList.remove('show');
        });

        colorDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            colorDropdownContent.classList.toggle('show');
            sizeDropdownContent.classList.remove('show');
        });

        document.addEventListener('click', () => {
            sizeDropdownContent.classList.remove('show');
            colorDropdownContent.classList.remove('show');
        });

        // Clear
        document.getElementById('clear-annotation-btn').addEventListener('click', () => {
            this.inkController.clear();
        });

        // Initial population
        this.updateSizeSelector();
        this.updateColorSelector();
    },

    updateSizeSelector() {
        const selector = document.getElementById('size-selector');
        const tool = this.inkController.currentTool;
        let sizes = [];

        if (tool === 'pen' || tool === 'eraser') {
            sizes = this.BRUSH_SIZES.PEN;
        } else if (tool === 'highlighter') {
            sizes = this.BRUSH_SIZES.HIGHLIGHTER;
        } else if (tool === 'text') {
            sizes = this.BRUSH_SIZES.TEXT;
        }

        selector.innerHTML = sizes.map(s => `
            <button class="brave-size-btn ${this.inkController.lineWidth === s.size ? 'active' : ''}" 
                    data-size="${s.size}">
                <div style="width: ${s.scale * 20}px; height: ${tool === 'highlighter' ? '20px' : s.scale * 20 + 'px'};
                            background: currentColor; ${tool === 'highlighter' ? '' : 'border-radius: 50%'}; opacity: 0.7;"></div>
            </button>
        `).join('');

        selector.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const size = parseInt(btn.dataset.size);
                this.inkController.setLineWidth(size);
                this.updateSizeSelector();
                // Update button indicator
                document.getElementById('current-size-indicator').style.transform = `scale(${btn.querySelector('div').style.width.replace('px', '') / 8})`;
            });
        });
    },

    updateColorSelector() {
        const selector = document.getElementById('color-selector');
        const tool = this.inkController.currentTool;
        let colors = [];

        if (tool === 'highlighter') {
            colors = this.HIGHLIGHTER_COLORS;
        } else {
            colors = this.BRUSH_COLORS;
        }

        selector.innerHTML = colors.map(c => `
            <div class="brave-color-btn ${this.inkController.color === c.color ? 'active' : ''}" 
                 style="background-color: ${c.color}" 
                 title="${c.label}"
                 data-color="${c.color}">
            </div>
        `).join('');

        selector.querySelectorAll('.brave-color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.inkController.setColor(btn.dataset.color);
                this.updateColorSelector();
                document.getElementById('current-color-indicator').style.backgroundColor = btn.dataset.color;
            });
        });

        document.getElementById('current-color-indicator').style.backgroundColor = this.inkController.color;
    },

    toggleAnnotationMode() {
        const isModeActive = this.inkController.toggleActive();
        const toolbar = document.getElementById('annotation-toolbar');
        const btn = document.getElementById('toggle-annotation-btn');
        const contentDiv = document.getElementById('grammar-html-content');

        if (isModeActive) {
            toolbar.style.display = 'flex';
            document.getElementById('grammar-content-wrapper').style.borderColor = 'var(--indigo-velvet)';
            btn.classList.add('active');
            btn.innerHTML = '<i class="fa-solid fa-xmark"></i> Stop Annotating';
            contentDiv.style.pointerEvents = 'none'; // Disable text selection while drawing
        } else {
            toolbar.style.display = 'none';
            document.getElementById('grammar-content-wrapper').style.borderColor = 'transparent';
            btn.classList.remove('active');
            btn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Annotate';
            contentDiv.style.pointerEvents = 'auto'; // Enable text selection
        }
    },

    generateExercises() {
        if (!this.currentGrammar) return;

        const grammar = this.currentGrammar;

        // Store grammar exercises in localStorage
        const grammarPracticeData = {
            grammarId: grammar.id,
            grammarRule: grammar.rule,
            exercises: grammar.exercises
        };

        localStorage.setItem('grammarPracticeData', JSON.stringify(grammarPracticeData));

        // Open practice.html in a new tab
        const practiceUrl = `practice.html?mode=grammar-practice&grammarId=${grammar.id}`;
        window.open(practiceUrl, '_blank');
    },

    handleUnjumbleClick(wordEl, idx) {
        const source = document.getElementById(`source-${idx}`);
        const target = document.getElementById(`target-${idx}`);

        if (wordEl.parentElement === source) {
            target.appendChild(wordEl);
        } else {
            source.appendChild(wordEl);
        }
    },

    handleDragStart(e) {
        e.target.classList.add('dragging');
        e.dataTransfer.setData('text/plain', ''); // Required for Firefox
        e.dataTransfer.effectAllowed = 'move';
    },

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        document.querySelectorAll('.unjumble-container').forEach(c => c.classList.remove('drag-over'));
    },

    handleDragOver(e) {
        e.preventDefault();
        const container = e.currentTarget;
        container.classList.add('drag-over');

        const dragging = document.querySelector('.dragging');
        if (!dragging) return;

        const afterElement = this.getDragAfterElement(container, e.clientX);
        if (afterElement == null) {
            container.appendChild(dragging);
        } else {
            container.insertBefore(dragging, afterElement);
        }
    },

    getDragAfterElement(container, x) {
        const draggableElements = [...container.querySelectorAll('.unjumble-word:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = x - box.left - box.width / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    },

    checkAnswers() {
        const display = document.getElementById('grammar-exercise-display');
        let correct = 0;
        let total = 0;

        // Check Fill-in and Error Correction
        const inputs = display.querySelectorAll('input[data-answer]');
        inputs.forEach(input => {
            total++;
            const answer = input.value.trim().toLowerCase().replace(/[.,!?;]$/, '');
            const correctAnswer = input.dataset.answer.toLowerCase().replace(/[.,!?;]$/, '');
            const result = input.nextElementSibling;

            if (answer === correctAnswer) {
                result.innerHTML = '✅ Correct!';
                result.style.color = '#28a745';
                input.style.borderColor = '#28a745';
                correct++;
            } else {
                result.innerHTML = `❌ Incorrect. Correct answer: ${input.dataset.answer}`;
                result.style.color = '#dc3545';
                input.style.borderColor = '#dc3545';
            }
        });

        // Check Unjumble Exercises
        const unjumbles = display.querySelectorAll('.unjumble-exercise');
        unjumbles.forEach(ex => {
            total++;
            const targetArea = ex.querySelector('.target-area');
            const result = ex.querySelector('.result');
            const userSentence = Array.from(targetArea.children).map(el => el.textContent).join(' ');
            const correctAnswer = ex.dataset.answer;

            // Clean both for comparison (remove trailing punctuation for better match)
            const cleanUser = userSentence.toLowerCase().replace(/[.,!?;]$/, '');
            const cleanCorrect = correctAnswer.toLowerCase().replace(/[.,!?;]$/, '');

            if (cleanUser === cleanCorrect) {
                result.innerHTML = '✅ Correct Sentence!';
                result.style.color = '#28a745';
                targetArea.style.borderColor = '#28a745';
                targetArea.querySelectorAll('.unjumble-word').forEach(w => w.classList.add('correct-pos'));
                correct++;
            } else {
                result.innerHTML = `❌ Incorrect. Expected: "${correctAnswer}"`;
                result.style.color = '#dc3545';
                targetArea.style.borderColor = '#dc3545';
                targetArea.querySelectorAll('.unjumble-word').forEach(w => w.classList.add('incorrect-pos'));
            }
        });

        const score = document.getElementById('grammar-score');
        const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
        score.innerHTML = `Score: ${correct}/${total} (${percentage}%)`;
    },

    setupEventListeners() {
        const catFilter = document.getElementById('grammar-category');
        const lvlFilter = document.getElementById('grammar-level');

        if (catFilter) {
            catFilter.addEventListener('change', (e) => {
                const level = document.getElementById('grammar-level').value;
                this.renderGrammarList(e.target.value, level);
            });
        }

        if (lvlFilter) {
            lvlFilter.addEventListener('change', (e) => {
                const category = document.getElementById('grammar-category').value;
                this.renderGrammarList(category, e.target.value);
            });
        }
    }
};

/** 
 * Perfect Freehand Logic (Simplified)
 * Calculates a variable-width stroke mesh from input points.
 */
function getStroke(points, options = {}) {
    const {
        size = 16,
        thinning = 0.5,
        smoothing = 0.5,
        streamline = 0.5,
        simulatePressure = true
    } = options;

    if (points.length === 0) return [];

    const totalPoints = points.length;
    const minPressure = 0.5;

    // Process points to add simulated pressure if needed
    const pts = points.map((p, i) => {
        let pressure = p.pressure;
        if (simulatePressure && totalPoints > 2) {
            // Simple velocity/index based pressure simulation
            if (i === 0 || i === totalPoints - 1) pressure = 0.2; // Taper ends
            else pressure = 0.5 + Math.random() * 0.1; // Random variation for natural feel
        }
        return { x: p.x, y: p.y, pressure: pressure || 0.5 };
    });

    const leftPts = [];
    const rightPts = [];

    let prev = pts[0];

    for (let i = 0; i < totalPoints; i++) {
        let curr = pts[i];

        // Width based on pressure
        let width = size * (1 - thinning * (1 - curr.pressure));
        width = Math.max(width, size * 0.2); // Min width check

        if (i === 0) {
            // Start cap
            if (totalPoints > 1) {
                const next = pts[1];
                const angle = Math.atan2(next.y - curr.y, next.x - curr.x);
                const dx = Math.sin(angle) * (width / 2);
                const dy = Math.cos(angle) * (width / 2);
                leftPts.push({ x: curr.x - dx, y: curr.y + dy });
                rightPts.push({ x: curr.x + dx, y: curr.y - dy });
            } else {
                // Dot
                const r = width / 2;
                for (let a = 0; a <= Math.PI * 2; a += 0.5) {
                    leftPts.push({ x: curr.x + Math.cos(a) * r, y: curr.y + Math.sin(a) * r });
                }
            }
        } else {
            // Direction vector
            const dx = curr.x - prev.x;
            const dy = curr.y - prev.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist === 0) continue;

            // Normal
            const nx = -dy / dist;
            const ny = dx / dist;

            const r = width / 2;
            leftPts.push({ x: curr.x + nx * r, y: curr.y + ny * r });
            rightPts.push({ x: curr.x - nx * r, y: curr.y - ny * r });
        }

        prev = curr;
    }

    return leftPts.concat(rightPts.reverse());
}

function getSvgPathFromStroke(stroke) {
    if (!stroke.length) return "";
    const d = stroke.reduce(
        (acc, [x0, y0], i, arr) => {
            const [x1, y1] = arr[(i + 1) % arr.length];
            acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
            return acc;
        },
        ["M", ...stroke[0], "Q"]
    );
    d.push("Z");
    return d.join(" ");
}

/**
 * Ink Controller
 * Manages canvas, rendering, and interaction logic.
 */
class InkController {
    constructor(canvasId, wrapperId) {
        this.canvas = document.getElementById(canvasId);
        this.wrapper = document.getElementById(wrapperId);
        this.ctx = this.canvas.getContext('2d');

        this.elements = []; // Array of { type, points, color, size, text, x, y, ... }
        this.currentStroke = null;
        this.selectedElement = null;
        this.draggingElement = null;
        this.dragOffset = { x: 0, y: 0 };

        this.isActive = false;
        this.currentTool = 'pen';
        this.color = '#2c3e50';
        this.lineWidth = 4;

        this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
        this.resizeObserver.observe(this.wrapper);

        this.setupEvents();
    }

    toggleActive() {
        this.isActive = !this.isActive;
        this.canvas.style.pointerEvents = this.isActive ? 'auto' : 'none';
        this.selectedElement = null;
        this.render();
        return this.isActive;
    }

    setTool(tool) {
        this.currentTool = tool;
        this.selectedElement = null;

        if (tool === 'pen') {
            this.lineWidth = 4;
            this.color = '#2c3e50';
        } else if (tool === 'highlighter') {
            this.lineWidth = 20;
            this.color = '#fff9c4';
        } else if (tool === 'eraser') {
            this.lineWidth = 30;
        } else if (tool === 'text') {
            // Text defaults
        }

        this.render();
    }

    setColor(color) {
        this.color = color;
        if (this.selectedElement && this.selectedElement.type === 'text') {
            this.selectedElement.color = color;
            this.render();
        }
    }

    setLineWidth(width) {
        this.lineWidth = width;
        if (this.selectedElement && this.selectedElement.type === 'text') {
            this.selectedElement.size = width;
            this.render();
        }
    }

    clear() {
        this.elements = [];
        this.render();
    }

    resizeCanvas() {
        const rect = this.wrapper.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.render();
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw all elements
        this.elements.forEach(el => {
            if (el.type === 'stroke') {
                this.drawStroke(el);
            } else if (el.type === 'text') {
                this.drawText(el);
            }
        });

        // Draw current stroke being drawn
        if (this.currentStroke) {
            this.drawStroke(this.currentStroke);
        }

        // Draw selection box
        if (this.selectedElement) {
            this.drawSelection(this.selectedElement);
        }
    }

    drawStroke(stroke) {
        const outlinePoints = getStroke(stroke.points, {
            size: stroke.size,
            thinning: stroke.tool === 'highlighter' ? 0 : 0.5,
            smoothing: 0.5,
            streamline: 0.5,
            simulatePressure: true
        });

        if (outlinePoints.length === 0) return;

        this.ctx.fillStyle = stroke.color;
        this.ctx.globalAlpha = stroke.tool === 'highlighter' ? 0.5 : 1.0;
        if (stroke.tool === 'highlighter') this.ctx.globalCompositeOperation = 'multiply';

        this.ctx.beginPath();
        this.ctx.moveTo(outlinePoints[0].x, outlinePoints[0].y);
        for (let i = 1; i < outlinePoints.length; i++) {
            this.ctx.lineTo(outlinePoints[i].x, outlinePoints[i].y);
        }
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.globalAlpha = 1.0;
        this.ctx.globalCompositeOperation = 'source-over';
    }

    drawText(textEl) {
        this.ctx.font = `${textEl.size}px 'Reddit Sans', sans-serif`;
        this.ctx.fillStyle = textEl.color;
        this.ctx.fillText(textEl.text, textEl.x, textEl.y);
    }

    drawSelection(el) {
        let bbox;
        if (el.type === 'text') {
            this.ctx.font = `${el.size}px 'Reddit Sans', sans-serif`;
            const metrics = this.ctx.measureText(el.text);
            bbox = {
                x: el.x - 5,
                y: el.y - el.size,
                width: metrics.width + 10,
                height: el.size + 5
            };
        } else {
            // Compute bbox for stroke
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            el.points.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
            const pad = el.size / 2 + 5;
            bbox = { x: minX - pad, y: minY - pad, width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 };
        }

        this.ctx.strokeStyle = '#3d348b';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);
        this.ctx.setLineDash([]);
    }

    getPointerPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            pressure: e.pressure
        };
    }

    hitTest(x, y) {
        // Reverse iterate to find top-most element
        for (let i = this.elements.length - 1; i >= 0; i--) {
            const el = this.elements[i];
            if (el.type === 'text') {
                this.ctx.font = `${el.size}px 'Reddit Sans', sans-serif`;
                const metrics = this.ctx.measureText(el.text);
                const h = el.size;
                // Simple bbox check for text
                if (x >= el.x && x <= el.x + metrics.width && y >= el.y - h && y <= el.y) {
                    return el;
                }
            } else if (el.type === 'stroke') {
                // Check distance to points
                // Optimization: Check bbox first
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                el.points.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
                const pad = el.size / 2 + 5;
                if (x < minX - pad || x > maxX + pad || y < minY - pad || y > maxY + pad) continue;

                // Detailed check
                for (const p of el.points) {
                    const dist = Math.hypot(p.x - x, p.y - y);
                    if (dist < el.size + 5) return el;
                }
            }
        }
        return null;
    }

    setupEvents() {
        const start = (e) => {
            if (!this.isActive) return;
            const pos = this.getPointerPos(e);

            if (this.currentTool === 'text') {
                // Check if clicking existing text to edit/move
                const hit = this.hitTest(pos.x, pos.y);
                if (hit && hit.type === 'text') {
                    this.selectedElement = hit;
                    this.draggingElement = hit;
                    this.dragOffset = { x: pos.x - hit.x, y: pos.y - hit.y };
                    this.render();
                    return;
                }
                // Create new text
                this.createText(pos.x, pos.y);
                return;
            }

            if (this.currentTool === 'eraser') {
                // Eraser logic
                const hit = this.hitTest(pos.x, pos.y);
                if (hit) {
                    // Remove element
                    this.elements = this.elements.filter(el => el !== hit);
                    this.render();
                }
                this.isDrawing = true; // Drag to erase
                return;
            }

            // Pen/Highlighter
            this.isDrawing = true;
            this.currentStroke = {
                type: 'stroke',
                tool: this.currentTool,
                color: this.color,
                size: this.lineWidth,
                points: [pos]
            };
            this.render();
        };

        const move = (e) => {
            if (!this.isActive) return;
            const pos = this.getPointerPos(e);

            if (this.draggingElement) {
                this.draggingElement.x = pos.x - this.dragOffset.x;
                this.draggingElement.y = pos.y - this.dragOffset.y;
                this.render();
                return;
            }

            if (this.currentTool === 'eraser' && this.isDrawing) {
                const hit = this.hitTest(pos.x, pos.y);
                if (hit) {
                    this.elements = this.elements.filter(el => el !== hit);
                    this.render();
                }
                return;
            }

            if (this.isDrawing && this.currentStroke) {
                this.currentStroke.points.push(pos);
                this.render();
            }
        };

        const end = () => {
            this.draggingElement = null;
            if (this.currentTool === 'eraser') {
                this.isDrawing = false;
                return;
            }

            if (this.isDrawing && this.currentStroke) {
                this.isDrawing = false;
                this.elements.push(this.currentStroke);
                this.currentStroke = null;
                this.render();
            }
        };

        // Double click to edit text
        const dblClick = (e) => {
            if (!this.isActive) return;
            const pos = this.getPointerPos(e);
            const hit = this.hitTest(pos.x, pos.y);
            if (hit && hit.type === 'text') {
                this.editText(hit);
            }
        };

        this.canvas.addEventListener('mousedown', start);
        this.canvas.addEventListener('mousemove', move);
        this.canvas.addEventListener('mouseup', end);
        this.canvas.addEventListener('dblclick', dblClick);

        // Touch support
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                e.preventDefault();
                start(e.touches[0]);
            }
        }, { passive: false });
        this.canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                e.preventDefault();
                move(e.touches[0]);
            }
        }, { passive: false });
        this.canvas.addEventListener('touchend', end);
    }

    createText(x, y) {
        const input = document.createElement('textarea');
        input.style.position = 'absolute';
        input.style.left = (x + this.canvas.offsetLeft) + 'px';
        input.style.top = (y + this.canvas.offsetTop) + 'px';
        input.style.font = `${this.lineWidth}px 'Reddit Sans', sans-serif`;
        input.style.color = this.color;
        input.style.background = 'rgba(255,255,255,0.8)';
        input.style.border = '1px dashed var(--indigo-velvet)';
        input.style.outline = 'none';
        input.style.zIndex = '1000';
        input.style.minWidth = '50px';
        input.style.minHeight = '1.2em';
        input.style.overflow = 'hidden';
        input.style.padding = '0';
        input.style.margin = '0';

        this.wrapper.appendChild(input);

        setTimeout(() => input.focus(), 0);

        const finish = () => {
            const text = input.value;
            if (text.trim()) {
                this.elements.push({
                    type: 'text',
                    text: text,
                    x: x,
                    y: y,
                    color: this.color,
                    size: this.lineWidth
                });
                this.render();
            }
            input.remove();
        };

        input.addEventListener('blur', finish);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                input.blur();
            }
        });
    }

    editText(textEl) {
        // Remove element from canvas to avoid duplication
        this.elements = this.elements.filter(el => el !== textEl);
        this.render();

        const input = document.createElement('textarea');
        input.value = textEl.text;
        input.style.position = 'absolute';
        input.style.left = (textEl.x + this.canvas.offsetLeft) + 'px';
        input.style.top = (textEl.y + this.canvas.offsetTop - textEl.size + 5) + 'px'; // Adjust for baseline
        input.style.font = `${textEl.size}px 'Reddit Sans', sans-serif`;
        input.style.color = textEl.color;
        input.style.background = 'rgba(255,255,255,0.8)';
        input.style.border = '1px dashed var(--indigo-velvet)';
        input.style.outline = 'none';
        input.style.zIndex = '1000';
        input.style.minWidth = '50px';

        this.wrapper.appendChild(input);
        input.focus();

        const finish = () => {
            const text = input.value;
            if (text.trim()) {
                this.elements.push({
                    ...textEl,
                    text: text
                });
                this.render();
            }
            input.remove();
        };

        input.addEventListener('blur', finish);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                input.blur();
            }
        });
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => GrammarModule.init());
} else {
    GrammarModule.init();
}

window.GrammarModule = GrammarModule;