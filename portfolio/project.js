// ===== Project page: animated metric counters =====
(function () {
    const nums = document.querySelectorAll('.pp-metric-num[data-count]');
    if (!nums.length) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function animate(el) {
        const target = parseInt(el.dataset.count, 10);
        const suffix = el.dataset.suffix || '';
        if (reduced) { el.textContent = target + suffix; return; }
        const dur = 1400;
        const start = performance.now();
        function frame(now) {
            const p = Math.min((now - start) / dur, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.round(target * eased) + suffix;
            if (p < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    const io = new IntersectionObserver((entries, obs) => {
        entries.forEach(e => {
            if (e.isIntersecting) { animate(e.target); obs.unobserve(e.target); }
        });
    }, { threshold: 0.5 });

    nums.forEach(n => { n.textContent = '0'; io.observe(n); });
})();

// ===== Back to top button =====
(function () {
    const btn = document.createElement('button');
    btn.className = 'back-to-top';
    btn.setAttribute('aria-label', 'Back to top');
    btn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
    btn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.body.appendChild(btn);
    function toggle() {
        btn.classList.toggle('show', window.scrollY > 500);
    }
    window.addEventListener('scroll', toggle, { passive: true });
    toggle();
})();

// ===== Scroll reveal =====
(function () {
    const els = document.querySelectorAll('.pp-section, .pp-showcase, .pp-cta-band');
    if (!els.length) return;
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        els.forEach(el => el.classList.add('in'));
        return;
    }
    const io = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (e) {
            if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(el => io.observe(el));
    // safety: reveal everything after 2.5s in case observer misses
    setTimeout(function () { els.forEach(el => el.classList.add('in')); }, 2500);
})();
