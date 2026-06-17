// ===== Interactive 3D Hero Object (Three.js) =====
(function () {
    var canvas = document.getElementById('hero3d');
    if (!canvas || typeof THREE === 'undefined') return;

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 6.4);

    var group = new THREE.Group();
    scene.add(group);

    // Faceted core
    var geo = new THREE.IcosahedronGeometry(2, 1);
    var core = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
            color: 0x12121a, metalness: 0.55, roughness: 0.35,
            flatShading: true, transparent: true, opacity: 0.92
        })
    );
    group.add(core);

    // Glowing wireframe overlay
    var wire = new THREE.LineSegments(
        new THREE.WireframeGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.55 })
    );
    group.add(wire);

    // Orbiting coloured lights → gradient sheen
    var lights = [
        new THREE.PointLight(0x8b5cf6, 1.1, 50),
        new THREE.PointLight(0x3b82f6, 1.1, 50),
        new THREE.PointLight(0xec4899, 1.0, 50)
    ];
    lights.forEach(function (l) { scene.add(l); });
    scene.add(new THREE.AmbientLight(0x404060, 0.6));

    function resize() {
        var w = canvas.clientWidth || canvas.offsetWidth;
        var h = canvas.clientHeight || canvas.offsetHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        // Scale object down on narrow screens
        var s = Math.min(1, w / 720) * 0.9 + 0.3;
        group.scale.setScalar(s);
        camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    // ---- Drag to spin (pointer) ----
    var dragging = false, lastX = 0, lastY = 0;
    var velX = reduced ? 0 : 0.0035, velY = 0;
    var autoSpin = reduced ? 0 : 0.0035;
    var px = 0, py = 0; // parallax target

    canvas.addEventListener('pointerdown', function (e) {
        dragging = true; lastX = e.clientX; lastY = e.clientY;
        canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
        hideHint();
    });
    canvas.addEventListener('pointermove', function (e) {
        if (dragging) {
            velX = (e.clientX - lastX) * 0.006;
            velY = (e.clientY - lastY) * 0.006;
            lastX = e.clientX; lastY = e.clientY;
        }
    });
    function endDrag() { dragging = false; }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('pointerleave', endDrag);

    // Subtle parallax from mouse
    if (!reduced) {
        window.addEventListener('mousemove', function (e) {
            px = (e.clientX / window.innerWidth - 0.5) * 0.6;
            py = (e.clientY / window.innerHeight - 0.5) * 0.6;
        }, { passive: true });
    }

    // ---- Run loop, paused when hero off-screen / tab hidden ----
    var visible = true;
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (en) { visible = en[0].isIntersecting; })
            .observe(document.getElementById('home'));
    }

    var t = 0;
    function frame() {
        requestAnimationFrame(frame);
        if (!visible || document.hidden) return;
        t += 0.016;

        group.rotation.y += velX;
        group.rotation.x += velY;
        group.rotation.x = Math.max(-0.9, Math.min(0.9, group.rotation.x));

        if (!dragging) {
            velX += (autoSpin - velX) * 0.03;
            velY *= 0.92;
        }

        if (!reduced) {
            group.position.y = Math.sin(t * 0.8) * 0.12;
            lights[0].position.set(Math.sin(t) * 4, Math.cos(t * 0.9) * 4, 3);
            lights[1].position.set(Math.cos(t * 0.7) * 4, Math.sin(t) * 4, 2.5);
            lights[2].position.set(Math.sin(t * 1.1) * 3.5, Math.cos(t) * 2, 4);
            camera.position.x += (px - camera.position.x) * 0.05;
            camera.position.y += (-py - camera.position.y) * 0.05;
            camera.lookAt(0, 0, 0);
        } else {
            lights[0].position.set(3, 4, 3);
            lights[1].position.set(-4, 1, 2.5);
            lights[2].position.set(1, -3, 4);
        }

        renderer.render(scene, camera);
    }
    frame();

    // ---- One-time "drag to spin" hint ----
    var hint = document.getElementById('hero3dHint');
    var hintTimer;
    function hideHint() { if (hint) { hint.classList.remove('show'); clearTimeout(hintTimer); } }
    if (hint && !reduced) {
        setTimeout(function () { hint.classList.add('show'); }, 2600);
        hintTimer = setTimeout(function () { hint.classList.remove('show'); }, 8000);
    }
})();
