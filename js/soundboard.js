/**
 * Soundboard — per-card audio with overlapping retrigger.
 * Play while already playing starts another copy of that slot.
 * Stop kills every live copy of that slot. Cards do not mute each other.
 */
(function () {
    'use strict';

    const MISSING_FILE_MSG = 'No sound file loaded for this slot yet';

    function showToast(msg, type = 'info') {
        const existing = document.querySelector('.sb-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.className = `sb-toast ${type}`;
        const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info';
        toast.innerHTML = `<i class="fa-solid ${icon}"></i> ${msg}`;
        document.body.appendChild(toast);
        requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3500);
    }

    function setIdle(ctrls) {
        ctrls.playBtn.disabled = false;
        ctrls.pauseBtn.disabled = true;
        ctrls.stopBtn.disabled = true;
    }

    function setPlaying(ctrls) {
        ctrls.playBtn.disabled = false;
        ctrls.pauseBtn.disabled = false;
        ctrls.stopBtn.disabled = false;
    }

    function setPaused(ctrls) {
        ctrls.playBtn.disabled = false;
        ctrls.pauseBtn.disabled = true;
        ctrls.stopBtn.disabled = false;
    }

    function silence(instance) {
        instance.pause();
        try {
            instance.currentTime = 0;
        } catch (e) {
            /* unloaded / missing sources can reject seek */
        }
    }

    function initCard(card) {
        const audio = card.querySelector('audio');
        const playBtn = card.querySelector('.sb-btn-play');
        const pauseBtn = card.querySelector('.sb-btn-pause');
        const stopBtn = card.querySelector('.sb-btn-stop');
        const ctrls = { playBtn, pauseBtn, stopBtn };

        let instances = [];
        let generation = 0;
        let srcFailed = false;
        let userPaused = false;

        function syncUi() {
            if (!instances.length) {
                userPaused = false;
                setIdle(ctrls);
                card.classList.remove('sb-playing');
                return;
            }
            if (userPaused) {
                setPaused(ctrls);
                card.classList.remove('sb-playing');
                return;
            }
            setPlaying(ctrls);
            card.classList.add('sb-playing');
        }

        function drop(instance) {
            instances = instances.filter(item => item !== instance);
            syncUi();
        }

        function stopAll() {
            generation += 1;
            userPaused = false;
            instances.forEach(silence);
            instances = [];
            syncUi();
        }

        function spawn() {
            const instance = new Audio(audio.src);
            const born = generation;

            instance.addEventListener('ended', () => drop(instance));
            instance.addEventListener('error', () => {
                srcFailed = true;
                drop(instance);
            });

            instances.push(instance);
            syncUi();

            return instance.play().then(() => {
                if (born !== generation) {
                    silence(instance);
                    drop(instance);
                    return;
                }
                syncUi();
            }).catch(err => {
                drop(instance);
                if (err && err.name === 'AbortError') return;
                srcFailed = true;
                showToast(MISSING_FILE_MSG, 'error');
                syncUi();
            });
        }

        playBtn.addEventListener('click', () => {
            if (srcFailed || audio.error) {
                showToast(MISSING_FILE_MSG, 'error');
                return;
            }

            if (userPaused) {
                userPaused = false;
                instances.forEach(instance => {
                    instance.play().catch(err => {
                        if (err && err.name === 'AbortError') return;
                        srcFailed = true;
                        showToast(MISSING_FILE_MSG, 'error');
                        drop(instance);
                    });
                });
                syncUi();
                return;
            }

            spawn();
        });

        pauseBtn.addEventListener('click', () => {
            userPaused = true;
            instances.forEach(instance => instance.pause());
            syncUi();
        });

        stopBtn.addEventListener('click', stopAll);
    }

    function init() {
        document.querySelectorAll('.sb-card').forEach(initCard);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
