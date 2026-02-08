/**
 * Perfect Freehand v1.2.0
 * Simplified implementation for smooth stroke rendering
 */

(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
        typeof define === 'function' && define.amd ? define(['exports'], factory) :
            (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.perfectFreehand = {}));
}(this, (function (exports) {
    'use strict';

    // Utility functions
    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function dist(a, b) {
        return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2));
    }

    function getStrokePoints(points, options = {}) {
        const {
            size = 16,
            thinning = 0.5,
            smoothing = 0.5,
            streamline = 0.5,
            simulatePressure = true,
            last = false
        } = options;

        const streamlineValue = 0.15 + (1 - streamline) * 0.85;
        const len = points.length;

        if (len === 0) return [];

        const pts = points.map((pt, i) => {
            const [x, y, pressure = 0.5] = Array.isArray(pt) ? pt : [pt.x, pt.y, pt.pressure];
            return { x, y, pressure, point: [x, y], vector: [1, 1], distance: 0, runningLength: 0 };
        });

        // Calculate vectors and distances
        for (let i = 1; i < pts.length; i++) {
            const prev = pts[i - 1];
            const curr = pts[i];
            const distance = dist(prev.point, curr.point);

            curr.distance = distance;
            curr.runningLength = prev.runningLength + distance;

            if (distance > 0) {
                curr.vector = [
                    (curr.point[0] - prev.point[0]) / distance,
                    (curr.point[1] - prev.point[1]) / distance
                ];
            } else {
                curr.vector = prev.vector;
            }
        }

        return pts;
    }

    function getStrokeOutlinePoints(points, options = {}) {
        const {
            size = 16,
            thinning = 0.5,
            smoothing = 0.5,
            simulatePressure = true,
            easing = t => t,
            start = {},
            end = {},
            last = false
        } = options;

        const pts = getStrokePoints(points, options);

        if (pts.length === 0) return [];
        if (pts.length === 1) {
            const { point, pressure } = pts[0];
            const radius = size * 0.5;
            const circle = [];
            for (let i = 0; i < 24; i++) {
                const angle = (Math.PI * 2 * i) / 24;
                circle.push([
                    point[0] + Math.cos(angle) * radius,
                    point[1] + Math.sin(angle) * radius
                ]);
            }
            return circle;
        }

        const leftPts = [];
        const rightPts = [];

        for (let i = 0; i < pts.length; i++) {
            const { point, pressure, vector } = pts[i];
            const radius = size * 0.5 * (1 - thinning * (1 - pressure));

            const perpendicular = [-vector[1], vector[0]];

            leftPts.push([
                point[0] - perpendicular[0] * radius,
                point[1] - perpendicular[1] * radius
            ]);

            rightPts.push([
                point[0] + perpendicular[0] * radius,
                point[1] + perpendicular[1] * radius
            ]);
        }

        return leftPts.concat(rightPts.reverse());
    }

    function getStroke(points, options = {}) {
        return getStrokeOutlinePoints(getStrokePoints(points, options), options);
    }

    exports.getStroke = getStroke;
    exports.getStrokePoints = getStrokePoints;
    exports.getStrokeOutlinePoints = getStrokeOutlinePoints;
    exports.default = getStroke;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
