const ScienceModule = {
    parts: {
        male: ['anther', 'filament'],
        female: ['stigma', 'style', 'ovary', 'ovule'],
        other: ['petal', 'sepal']
    },

    definitions: {
        'anther': { title: 'Anther', text: 'Produces pollen grains.' },
        'filament': { title: 'Filament', text: 'Connects the anther to the flower.' },
        'stigma': { title: 'Stigma', text: 'Receives the pollen grains.' },
        'style': { title: 'Style', text: 'Connects the stigma to the ovary.' },
        'ovary': { title: 'Ovary', text: 'Contains the ovules.' },
        'ovule': { title: 'Ovule', text: 'Contains the egg cell.' },
        'petal': { title: 'Petal', text: 'To attract pollinators.' },
        'sepal': { title: 'Sepal', text: 'Protects flower bud.' }
    },

    init() {
        console.log('Initializing Science Module...');
        this.loadSVG();
        this.setupControls();
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

        // Make SVG responsive
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', 'auto');

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
                this.handleHover(group.key);
                // Highlight the specific group hovered
                group.element.classList.add('hovered');
            }
        });

        svg.addEventListener('mouseout', (e) => {
            const group = getParentGroup(e.target);
            if (group) {
                this.hideHover();
                group.element.classList.remove('hovered');
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
    },

    handleHover(key) {
        const label = document.getElementById('hover-label');
        if (!label) return;

        const info = this.definitions[key];
        label.textContent = info ? info.title : key;
        label.style.display = 'block';

        // Position label near mouse? Or just fixed?
        // For now, fixed position relative to container is easier or following mouse
        // CSS handles position, JS handles visibility
    },

    hideHover() {
        const label = document.getElementById('hover-label');
        if (label) label.style.display = 'none';

        // Also remove 'hovered' class from all groups
        /* const groups = document.querySelectorAll('#flower-svg-container g');
        groups.forEach(g => g.classList.remove('hovered')); */
        // Handled in mouseout event per element
    },

    showDefinition(key) {
        const info = this.definitions[key];
        if (!info) return;

        const titleParams = document.getElementById('info-title');
        const descParams = document.getElementById('info-desc');

        if (titleParams) titleParams.textContent = info.title;
        if (descParams) descParams.textContent = info.text;

        // Show the info box if not visible
        document.getElementById('part-info-box')?.classList.add('visible');
    },

    highlightType(type) {
        this.resetHighlight();

        // Find all groups matching the type
        const partsToHighlight = this.parts[type];
        if (!partsToHighlight) return;

        const svg = document.querySelector('#flower-svg-container svg');
        if (!svg) return;

        // Iterate over all groups and check IDs
        const groups = svg.querySelectorAll('g');
        groups.forEach(g => {
            const id = g.id.toLowerCase();
            const match = partsToHighlight.find(p => id.startsWith(p));
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
