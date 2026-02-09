const ScienceModule = {
    parts: {
        male: ['anther', 'filament'],
        female: ['stigma', 'style', 'ovary', 'ovule'],
        other: ['petal', 'sepal']
    },

    definitions: {
        'anther': {
            title: 'Anther',
            text: 'Produces pollen grains.',
            detailed: 'Produces pollen grains which contain the male reproductive cell. Pollen grains are sticky to stick onto body of pollinators.'
        },
        'filament': {
            title: 'Filament',
            text: 'Connects the anther to the flower.',
            detailed: 'Connects the anther to the flower.'
        },
        'stigma': {
            title: 'Stigma',
            text: 'Receives the pollen grains.',
            detailed: 'Receives the pollen grains.'
        },
        'style': {
            title: 'Style',
            text: 'Connects the stigma to the ovary.',
            detailed: 'Connects the stigma to the ovary.'
        },
        'ovary': {
            title: 'Ovary',
            text: 'Contains the ovules.',
            detailed: 'Contains the ovules. Develops into a fruit after fertilisation.'
        },
        'ovule': {
            title: 'Ovule',
            text: 'Contains the egg cell.',
            detailed: 'Contains the egg cell. Develops into a seed after fertilisation.'
        },
        'petal': {
            title: 'Petal',
            text: 'To attract pollinators.',
            detailed: 'To attract pollinators. Usually brightly coloured.'
        },
        'sepal': {
            title: 'Sepal',
            text: 'Protects flower bud.',
            detailed: 'Protects flower bud.'
        }
    },

    // Helper function to normalize flower part IDs (remove number suffixes)
    normalizeId(id) {
        if (!id) return '';
        // Remove -2, -3, etc. suffixes to treat anther-2, anther-3 as 'anther'
        return id.replace(/-\d+$/, '').toLowerCase();
    },

    mousePosition: { x: 0, y: 0 },

    init() {
        console.log('Initializing Science Module...');
        this.loadSVG();
        this.setupControls();
        this.setupMouseTracking();
    },

    setupMouseTracking() {
        const container = document.getElementById('flower-svg-container');
        if (!container) return;

        container.addEventListener('mousemove', (e) => {
            const rect = container.getBoundingClientRect();
            this.mousePosition.x = e.clientX - rect.left;
            this.mousePosition.y = e.clientY - rect.top;
        });
    },

    async loadSVG() {
        const container = document.getElementById('flower-svg-container');
        if (!container) return;

        try {
            const response = await fetch('flower-parts.svg');
            let svgText = await response.text();

            // Clean up SVG if needed (remove xml tag)
            svgText = svgText.replace(/<\?xml.*?\?>/, '');

            container.innerHTML = svgText;

            // After injection, setup SVG interactions
            this.setupSVGInteractions();

        } catch (error) {
            console.error('Failed to load SVG:', error);
            container.innerHTML = '<p class="error">Failed to load diagram.</p>';
        }
    },

    setupSVGInteractions() {
        const svg = document.querySelector('#flower-svg-container svg');
        if (!svg) return;

        // Remove fixed width/height to allow CSS max-height to control size
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        // Add hover listeners to all relevant groups
        const allKeys = Object.keys(this.definitions);

        // Helper to find parent group with known ID
        const getParentGroup = (element) => {
            let current = element;
            while (current && current !== svg) {
                if (current.tagName === 'g' && current.id) {
                    // Check if ID matches or starts with a known key
                    const id = current.id.toLowerCase();
                    const match = allKeys.find(key => id.startsWith(key));
                    if (match) return { element: current, key: match };
                }
                current = current.parentNode;
            }
            return null;
        };

        svg.addEventListener('mouseover', (e) => {
            const group = getParentGroup(e.target);
            if (group) {
                this.handleHover(group.key, group.element);
                // Dim all other parts
                this.dimOtherParts(group.element);
            }
        });

        svg.addEventListener('mouseout', (e) => {
            const group = getParentGroup(e.target);
            if (group) {
                this.hideHover();
                // Reset all parts to full opacity
                this.resetDimming();
            }
        });

        svg.addEventListener('click', (e) => {
            const group = getParentGroup(e.target);
            if (group) {
                this.showDefinition(group.key);
            }
        });
    },

    setupControls() {
        document.getElementById('btn-male')?.addEventListener('click', () => this.highlightType('male'));
        document.getElementById('btn-female')?.addEventListener('click', () => this.highlightType('female'));
        document.getElementById('btn-reset')?.addEventListener('click', () => this.resetHighlight());

        document.getElementById('btn-help')?.addEventListener('click', (e) => {
            e.currentTarget.classList.toggle('active');
            const infoBox = document.getElementById('part-info-box');
            infoBox.classList.toggle('visible');
        });

        document.getElementById('btn-quiz')?.addEventListener('click', () => {
            const modal = document.getElementById('quiz-modal');
            if (modal) {
                modal.style.display = 'flex';
                if (window.FlowerQuiz) {
                    FlowerQuiz.init();
                }
            }
        });

        document.getElementById('btn-bones-quiz')?.addEventListener('click', () => {
            const modal = document.getElementById('quiz-modal');
            if (modal) {
                modal.style.display = 'flex';
                if (window.BonesQuiz) {
                    BonesQuiz.init();
                }
            }
        });
    },

    handleHover(key, element) {
        const label = document.getElementById('hover-label');
        if (!label) return;

        const info = this.definitions[key];
        label.textContent = info ? info.title : key;
        label.style.display = 'block';

        // Position label near the mouse cursor
        const offset = 15;
        label.style.left = (this.mousePosition.x + offset) + 'px';
        label.style.top = (this.mousePosition.y + offset) + 'px';
    },

    dimOtherParts(hoveredElement) {
        const svg = document.querySelector('#flower-svg-container svg');
        if (!svg) return;

        const groups = svg.querySelectorAll('g');
        groups.forEach(g => {
            // Only apply dimming to top-level flower part groups
            // (groups that have an ID in definitions AND whose parent is NOT a flower part)
            if (g !== hoveredElement && g.id && this.definitions[g.id]) {
                const parent = g.parentElement;
                const parentIsFlowerPart = parent && parent.id && this.definitions[parent.id];

                // Only dim if this is a top-level flower part (parent is not a flower part)
                if (!parentIsFlowerPart) {
                    g.classList.add('dimmed-hover');
                }
            }
        });
    },

    resetDimming() {
        const svg = document.querySelector('#flower-svg-container svg');
        if (!svg) return;

        const groups = svg.querySelectorAll('g');
        groups.forEach(g => {
            g.classList.remove('dimmed-hover');
        });
    },

    hideHover() {
        const label = document.getElementById('hover-label');
        if (label) label.style.display = 'none';
    },

    showDefinition(key) {
        const info = this.definitions[key];
        if (!info) return;

        const titleParams = document.getElementById('info-title');
        const descParams = document.getElementById('info-desc');

        if (titleParams) titleParams.textContent = info.title;
        if (descParams) descParams.textContent = info.detailed || info.text;

        // Show the info box if not visible
        const infoBox = document.getElementById('part-info-box');
        if (infoBox) {
            infoBox.classList.add('visible');
            // Add a highlight effect
            infoBox.style.animation = 'none';
            setTimeout(() => {
                infoBox.style.animation = 'pulseInfo 0.5s ease-out';
            }, 10);
        }
    },

    highlightType(type) {
        this.resetHighlight();

        // Find all groups matching the type
        const partsToHighlight = this.parts[type];
        if (!partsToHighlight) return;

        const svg = document.querySelector('#flower-svg-container svg');
        if (!svg) return;

        const allKeys = Object.keys(this.definitions);

        // Iterate over all groups and check IDs
        const groups = svg.querySelectorAll('g');
        groups.forEach(g => {
            if (!g.id) return;

            const normalizedId = this.normalizeId(g.id);

            // Only apply effects to top-level flower part groups
            if (!allKeys.includes(normalizedId)) return;

            const parent = g.parentElement;
            const parentNormalizedId = this.normalizeId(parent?.id);
            const parentIsFlowerPart = allKeys.includes(parentNormalizedId);

            // Only process if this is a top-level flower part
            if (parentIsFlowerPart) return;

            const match = partsToHighlight.includes(normalizedId);
            if (match) {
                g.classList.add('highlighted');
            } else {
                g.classList.add('dimmed');
            }
        });
    },

    resetHighlight() {
        const svg = document.querySelector('#flower-svg-container svg');
        if (!svg) return;

        const groups = svg.querySelectorAll('g');
        groups.forEach(g => {
            g.classList.remove('highlighted');
            g.classList.remove('dimmed');
        });

        // Reset info box text
        const titleParams = document.getElementById('info-title');
        const descParams = document.getElementById('info-desc');
        if (titleParams) titleParams.textContent = 'Flower Parts';
        if (descParams) descParams.textContent = 'Hover over the flower parts to identify them. Click buttons to see classifications.';
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only init if we are on the main page with the science section
    if (document.getElementById('science')) {
        ScienceModule.init();
    }
});
