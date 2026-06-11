// ===== Core interactivity =====
// Navbar Scroll Effect + Scroll Progress Bar + Active Nav (Scroll-Spy)
const navbar = document.getElementById('navbar');
const scrollProgress = document.getElementById('scrollProgress');
const spySections = document.querySelectorAll('section[id]');
const spyLinks = document.querySelectorAll('.nav-links a[href^="#"]');

function onScrollUpdate() {
    // navbar bg
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }

    // progress bar
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (window.scrollY / docHeight) * 100 : 0;
    scrollProgress.style.width = pct + '%';

    // scroll-spy: find current section
    let current = '';
    spySections.forEach(sec => {
        if (window.scrollY >= sec.offsetTop - 120) {
            current = sec.id;
        }
    });
    spyLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === '#' + current);
    });
}

window.addEventListener('scroll', onScrollUpdate, { passive: true });
onScrollUpdate();

// Mobile Menu Toggle
const mobileToggle = document.getElementById('mobileToggle');
const navLinks = document.getElementById('navLinks');

mobileToggle.addEventListener('click', () => {
    navLinks.classList.toggle('active');
    const icon = mobileToggle.querySelector('i');
    if (navLinks.classList.contains('active')) {
        icon.classList.remove('fa-bars');
        icon.classList.add('fa-xmark');
    } else {
        icon.classList.remove('fa-xmark');
        icon.classList.add('fa-bars');
    }
});

// Close mobile menu on link click
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        mobileToggle.querySelector('i').classList.add('fa-bars');
        mobileToggle.querySelector('i').classList.remove('fa-xmark');
    });
});

// Scroll Reveal Animation via Intersection Observer
const revealOptions = {
    threshold: 0.15,
    rootMargin: "0px 0px -50px 0px"
};

const revealObserver = new IntersectionObserver(function (entries, observer) {
    entries.forEach(entry => {
        if (!entry.isIntersecting) {
            return;
        }
        entry.target.classList.add("active");
        // Stop observing once revealed
        observer.unobserve(entry.target);
    });
}, revealOptions);

document.querySelectorAll('.reveal').forEach(el => {
    revealObserver.observe(el);
});

// ===== Footer year =====
document.getElementById('footerYear').textContent = new Date().getFullYear();

// ===== Tilt, AI assistant, pipeline, features =====
// Custom Mouse Glow Effect for Project Cards
const cards = document.querySelectorAll('.project-card');
cards.forEach(card => {
    card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
    });
});

// Detect touch devices to perfectly split Hover vs Tap logic
if ('ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0) {
    document.body.classList.add('touch-device');
}

// Mobile touch support for 3D flip cards
document.querySelectorAll('.flip-card').forEach(card => {
    card.addEventListener('click', function (e) {
        // Prevent intercepting clicks on internal links
        if (e.target.closest('a')) return;

        const isFlipped = this.classList.contains('flipped');
        // Remove flipped class from all cards
        document.querySelectorAll('.flip-card').forEach(c => c.classList.remove('flipped'));

        // Toggle current card
        if (!isFlipped) {
            this.classList.add('flipped');
        }
    });
});

// AI Assistant Logic
const aiRobot = document.getElementById('aiRobot');
const aiSpeech = document.getElementById('aiSpeech');
const aiMenu = document.getElementById('aiMenu');
const laserScanner = document.getElementById('laserScanner');
const qaModal = document.getElementById('qaModal');
const qaModalClose = document.getElementById('qaModalClose');
const qaModalBody = document.getElementById('qaModalBody');
let aiMessageTimeout;
let isScriptedMove = false;

function setAiState(state, message) {
    aiRobot.className = 'ai-robot-body ' + state;
    if (message) {
        aiSpeech.textContent = message;
        aiSpeech.classList.add('visible');
        clearTimeout(aiMessageTimeout);
        aiMessageTimeout = setTimeout(() => {
            aiSpeech.classList.remove('visible');
        }, 3500);
    } else {
        aiSpeech.classList.remove('visible');
    }
}

// AI Organic Roaming Mechanic
const aiWrap = document.querySelector('.ai-wrap');
let botPos = { x: 0, y: 0 };
let targetBotPos = { x: 0, y: 0 };
let roamInterval;

function pickNewTarget() {
    // Keep bounds in a neat, premium bottom-right quadrant to stay within active view
    const limitX = Math.min(window.innerWidth - 150, 350);
    const limitY = Math.min(window.innerHeight - 200, 250);
    targetBotPos.x = -(Math.random() * limitX);
    targetBotPos.y = -(Math.random() * limitY);
}

pickNewTarget();
roamInterval = setInterval(pickNewTarget, 4000);

function roamRobot() {
    const isMenuOpen = aiMenu.classList.contains('active');
    // Lerp towards target position for smooth organic drifting (only if not scripted and menu is closed)
    if (!isScriptedMove && !isMenuOpen) {
        botPos.x += (targetBotPos.x - botPos.x) * 0.005;
        botPos.y += (targetBotPos.y - botPos.y) * 0.005;
        aiWrap.style.transform = `translate(${botPos.x}px, ${botPos.y}px)`;
    }
    requestAnimationFrame(roamRobot);
}
roamRobot();

// Pause roaming when hovered
aiRobot.addEventListener('mouseenter', () => {
    if (!isScriptedMove) clearInterval(roamInterval);
});
aiRobot.addEventListener('mouseleave', () => {
    if (!isScriptedMove) {
        clearInterval(roamInterval);
        roamInterval = setInterval(pickNewTarget, 4000);
    }
});

// Toggle Smart Menu on click (robust selector for whole body + head + torso)
const robotElements = [aiRobot, document.querySelector('.bot-head'), document.querySelector('.bot-torso')];
robotElements.forEach(el => {
    if (el) {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isScriptedMove) return;
            aiMenu.classList.toggle('active');
            if (aiMenu.classList.contains('active')) {
                // Dynamically check position to prevent menu clipping at the top
                const rect = aiRobot.getBoundingClientRect();
                if (rect.top < 280) {
                    aiMenu.classList.add('menu-bottom');
                } else {
                    aiMenu.classList.remove('menu-bottom');
                }
                setAiState('working', 'Select Protocol ⚡');
            } else {
                setAiState('', '');
            }
        });
    }
});

// Close smart menu when clicking outside
document.addEventListener('click', (e) => {
    if (!aiWrap.contains(e.target) && !qaModal.contains(e.target)) {
        aiMenu.classList.remove('active');
    }
});

// Close QA Diagnostics Modal
qaModalClose.addEventListener('click', () => {
    qaModal.classList.remove('active');
    setAiState('', 'Diagnostics Closed.');
});

// Smart Menu Actions Trigger
aiMenu.addEventListener('click', (e) => {
    const btn = e.target.closest('.ai-menu-btn');
    if (!btn) return;

    const action = btn.dataset.action;
    aiMenu.classList.remove('active');

    if (action === 'scan') {
        triggerDiagnosticScan();
    } else if (action === 'skills') {
        triggerSkillTelemetry();
    } else if (action === 'project') {
        triggerProjectHighlight();
    } else if (action === 'bug') {
        triggerBugGame();
    } else if (action === 'resume') {
        triggerResumeDownload();
    } else if (action === 'dance') {
        triggerDanceVibe();
    }
});

// Scripted Move Helpers
function runScriptedMove(targetX, targetY, callback) {
    isScriptedMove = true;
    clearInterval(roamInterval);
    aiWrap.style.transition = 'transform 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
    aiWrap.style.transform = `translate(${targetX}px, ${targetY}px)`;

    botPos.x = targetX;
    botPos.y = targetY;

    setTimeout(callback, 1200);
}

function endScriptedMove() {
    aiWrap.style.transition = 'transform 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
    aiWrap.style.transform = `translate(0px, 0px)`;
    botPos.x = 0;
    botPos.y = 0;
    targetBotPos.x = 0;
    targetBotPos.y = 0;

    setTimeout(() => {
        aiWrap.style.transition = '';
        isScriptedMove = false;
        roamInterval = setInterval(pickNewTarget, 4000);
    }, 1200);
}

// Action 1: Full-Screen Laser Diagnostics Scan
function triggerDiagnosticScan() {
    setAiState('working', 'Scanning sequence initialized...');

    // Glide robot to top-right corner
    const targetY = -(window.innerHeight - 150);
    const targetX = -50;

    runScriptedMove(targetX, targetY, () => {
        setAiState('working', 'Full Page Laser Sweep Active!');
        laserScanner.classList.add('active');

        // Sweep line mid-way sound/bubble
        setTimeout(() => {
            setAiState('working', 'Analyzing DOM & Defect Telemetry...');
        }, 1200);

        // Sweep completes
        setTimeout(() => {
            laserScanner.classList.remove('active');
            setAiState('dancing', 'Scan Complete! compiling diagnostics...');

            setTimeout(() => {
                endScriptedMove();
                showDiagnosticsModal();
            }, 800);
        }, 2500);
    });
}

// Animated QA Terminal Logs injection
function showDiagnosticsModal() {
    qaModalBody.innerHTML = '';
    qaModal.classList.add('active');

    const logs = [
        { text: "[INFO] Initializing QA Webdriver Core Automation...", type: "info" },
        { text: "[INFO] Establishing telemetry socket over SSL/TLS...", type: "info" },
        { text: "[PASS] UI Integrity Check: 0 rendering defects found.", type: "pass" },
        { text: "[PASS] Page Load Performance: LCP 0.6s, FID 8ms (Peak).", type: "pass" },
        { text: "[PASS] Interactive 3D Nodes: Vitals intact.", type: "pass" },
        { text: "[WARN] Telemetry: Hyper-advanced code matrices detected in Abhinav's systems.", type: "warn" },
        { text: "[PASS] Assertions: 48/48 test vectors GREEN. Zero bugs verified.", type: "pass" }
    ];

    logs.forEach((log, index) => {
        setTimeout(() => {
            const line = document.createElement('div');
            line.className = 'qa-log-line';

            let tagHtml = '';
            if (log.type === 'info') tagHtml = '<span class="qa-tag-info">[INFO]</span>';
            if (log.type === 'pass') tagHtml = '<span class="qa-tag-pass">[PASS]</span>';
            if (log.type === 'warn') tagHtml = '<span class="qa-tag-warn">[WARN]</span>';

            line.innerHTML = `${tagHtml} ${log.text.substring(7)}`;
            qaModalBody.appendChild(line);

            line.offsetHeight; // force reflow
            line.classList.add('printed');
        }, index * 350);
    });

    // Print certified status seal box at the end
    setTimeout(() => {
        const statusBox = document.createElement('div');
        statusBox.className = 'qa-status-box';
        statusBox.innerHTML = `
            <div class="qa-status-title">SYSTEM AUDIT INTEGRITY</div>
            <div class="qa-status-value">100% SECURE & OPTIMIZED</div>
        `;
        qaModalBody.appendChild(statusBox);

        statusBox.offsetHeight;
        statusBox.classList.add('printed');
        setAiState('dancing', 'System Audit: 100% Secure!');
    }, logs.length * 350 + 200);
}

// Action 2: Skill Telemetry scan
function triggerSkillTelemetry() {
    setAiState('working', 'Scanning core skill matrix...');
    document.getElementById('skills').scrollIntoView({ behavior: 'smooth' });

    setTimeout(() => {
        setAiState('dancing', 'HTML, Selenium, Python at 100% load capacities!');

        // Highlight and pulse all skill cards
        const skillCards = document.querySelectorAll('.skill-card .flip-front');
        skillCards.forEach(card => card.classList.add('telemetry-pulse'));

        setTimeout(() => {
            skillCards.forEach(card => card.classList.remove('telemetry-pulse'));
            setAiState('', 'Skill telemetry verified.');
        }, 3500);
    }, 800);
}

// Action 3: Project Highlight
function triggerProjectHighlight() {
    setAiState('working', 'Locating system featured projects...');
    const projectsSection = document.getElementById('projects');
    projectsSection.scrollIntoView({ behavior: 'smooth' });

    setTimeout(() => {
        const abhimateCard = document.getElementById('project-abhimate');
        if (abhimateCard) {
            setAiState('dancing', 'Target Acquired! AbhiMate: Multi-Agent QA Core.');

            // Programmatically flip the card to show logs
            abhimateCard.classList.add('telemetry-pulse');
            abhimateCard.classList.add('flipped');

            setTimeout(() => {
                abhimateCard.classList.remove('telemetry-pulse');
                abhimateCard.classList.remove('flipped');
                setAiState('', 'Project highlighted.');
            }, 5000);
        }
    }, 800);
}

// Action 4: Vibe Matrix (Dance Mode)
let vibeInterval;
function triggerDanceVibe() {
    let cycles = 0;
    const dancePhrases = [
        "BEEP... BOOP... DANCE PROTOCOL! 🕺",
        "Grooving through the codebase! ⚡",
        "QA Automation has 100% groove! 🎸",
        "Matrix Vitals: PURE VIBES! 🚀"
    ];

    setAiState('dancing', dancePhrases[0]);
    clearInterval(vibeInterval);

    vibeInterval = setInterval(() => {
        cycles++;
        if (cycles < dancePhrases.length) {
            setAiState('dancing', dancePhrases[cycles]);
        } else {
            clearInterval(vibeInterval);
            setAiState('', 'Dance matrix synced successfully.');
        }
    }, 1200);
}

// Action: Dynamic Resume Download from AI Companion menu
function triggerResumeDownload() {
    setAiState('dancing', 'Downloading Abhinav\'s Resume PDF... ⚡');

    setTimeout(() => {
        const link = document.createElement('a');
        link.href = 'AbhinavSaxena.pdf';
        link.download = 'Abhinav_Saxena_Resume.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setAiState('dancing', 'Resume Download Successful! 🏆');
    }, 1000);
}

document.querySelectorAll('.skill-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
        if (!isScriptedMove) setAiState('working', 'Scanning Skill Modules...');
    });
    card.addEventListener('mouseleave', () => {
        if (!isScriptedMove) setAiState('', '');
    });
});

document.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
        if (!isScriptedMove) setAiState('dancing', 'Analyzing Systems! ⚡');
    });
    card.addEventListener('mouseleave', () => {
        if (!isScriptedMove) setAiState('', '');
    });
});

// Section Observer for AI Context
const secOptions = { threshold: 0.2, rootMargin: "-10% 0px" };
const secObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && !isScriptedMove) {
            const id = entry.target.id;
            let msg = '';
            if (id === 'home') msg = 'Click me for protocols! 🤖';
            if (id === 'about') msg = 'Running Background Check...';
            if (id === 'skills') msg = 'Hover items to test me!';
            if (id === 'projects') msg = 'Exploring deployed nodes...';
            if (id === 'experience') msg = 'Reviewing logs timeline...';
            if (id === 'contact') msg = 'Standing by for communication.';

            if (aiRobot.className.trim() === 'ai-robot-body') {
                setAiState('', msg);
            }
        }
    });
}, secOptions);

document.querySelectorAll('section').forEach(sec => secObserver.observe(sec));

/* --- FEATURE 1: Interactive Canvas Engine --- */
const canvas = document.getElementById('matrixGridCanvas');
const ctx = canvas.getContext('2d');
let particles = [];
const maxParticles = 65;
let mouseX = null;
let mouseY = null;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 1;
        this.speedX = Math.random() * 0.4 - 0.2;
        this.speedY = Math.random() * 0.4 - 0.2;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x > canvas.width) this.x = 0;
        else if (this.x < 0) this.x = canvas.width;
        if (this.y > canvas.height) this.y = 0;
        else if (this.y < 0) this.y = canvas.height;

        // Mouse magnetic effect
        if (mouseX !== null && mouseY !== null) {
            const dx = mouseX - this.x;
            const dy = mouseY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 120) {
                const force = (120 - dist) / 120;
                this.x -= (dx / dist) * force * 1.5;
                this.y -= (dy / dist) * force * 1.5;
            }
        }
    }
    draw() {
        ctx.fillStyle = document.documentElement.getAttribute('data-theme') === 'light' ? 'rgba(139, 92, 246, 0.4)' : 'rgba(139, 92, 246, 0.3)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function initParticles() {
    particles = [];
    for (let i = 0; i < maxParticles; i++) {
        particles.push(new Particle());
    }
}
initParticles();

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
        p.update();
        p.draw();
    });

    // Draw connecting lines
    ctx.strokeStyle = document.documentElement.getAttribute('data-theme') === 'light' ? 'rgba(139, 92, 246, 0.04)' : 'rgba(139, 92, 246, 0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 100) {
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.stroke();
            }
        }
    }
    requestAnimationFrame(animateParticles);
}
animateParticles();

/* --- FEATURE 2: Mouse Tracker for Canvas Engine --- */
window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});
window.addEventListener('mouseleave', () => {
    mouseX = null;
    mouseY = null;
});

/* --- FEATURE 3: My Testing Workflow Controller --- */
const wfStages = [
    {
        title: '01 · Requirement Analysis',
        desc: 'I study requirements and user stories, map out testable scenarios, and flag ambiguities with the team early — before a single test is written.',
        tools: ['Jira', 'Confluence', 'BRD/User Stories'],
        deliverable: 'Test scenarios + clarification log'
    },
    {
        title: '02 · Test Design',
        desc: 'I write detailed test cases covering happy paths, edge cases and business rules — each one traceable back to its requirement.',
        tools: ['ALM', 'Excel/Sheets', 'RTM'],
        deliverable: 'Test cases + traceability matrix'
    },
    {
        title: '03 · Test Execution',
        desc: 'I run functional, integration and end-to-end cycles on every build, capturing evidence for each result — pass or fail.',
        tools: ['ALM', 'Chrome DevTools', 'Postman'],
        deliverable: 'Execution report with evidence'
    },
    {
        title: '04 · Defect Reporting',
        desc: 'Every defect gets clear repro steps, severity, screenshots and logs — then tracked through its full lifecycle until verified closed.',
        tools: ['Jira', 'Bug Lifecycle', 'Severity Triage'],
        deliverable: 'Actionable bug reports'
    },
    {
        title: '05 · Automation',
        desc: 'Stable, repetitive flows get automated with Selenium and Python — cutting regression turnaround time drastically for the whole team.',
        tools: ['Selenium', 'Python', 'TestNG', 'Robot Framework'],
        deliverable: 'Reusable automation suite'
    },
    {
        title: '06 · Regression & Sign-off',
        desc: 'Before release I run the automated regression pack and validate data integrity with SQL — then give the final quality sign-off.',
        tools: ['Selenium Suite', 'SQL', 'Release Checklist'],
        deliverable: 'Release quality sign-off'
    }
];

(function () {
    const nodes = Array.from(document.querySelectorAll('#pipeline .pipeline-stage'));
    const progress = document.getElementById('workflowProgress');
    const playBtn = document.getElementById('workflowPlayBtn');
    const elTitle = document.getElementById('wfTitle');
    const elDesc = document.getElementById('wfDesc');
    const elTools = document.getElementById('wfTools');
    const elDeliv = document.getElementById('wfDeliverable');
    if (!nodes.length || !elTitle) return;

    let playTimer = null;

    function select(i) {
        const s = wfStages[i];
        nodes.forEach(function (n, idx) {
            n.classList.remove('active', 'success');
            if (idx < i) n.classList.add('success');
            if (idx === i) n.classList.add('active');
        });
        progress.style.width = (i / (wfStages.length - 1)) * 80 + '%';
        elTitle.classList.remove('wf-done');
        elTitle.textContent = s.title;
        elDesc.textContent = s.desc;
        elTools.innerHTML = s.tools.map(function (t) {
            return '<span class="wf-chip">' + t + '</span>';
        }).join('');
        elDeliv.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Deliverable: ' + s.deliverable;
    }

    function stopPlay() {
        if (playTimer) { clearInterval(playTimer); playTimer = null; }
        playBtn.innerHTML = '<i class="fa-solid fa-play"></i> Walk Through';
    }

    nodes.forEach(function (n) {
        n.style.cursor = 'pointer';
        n.addEventListener('click', function () {
            stopPlay();
            select(parseInt(n.dataset.stage, 10));
        });
    });

    playBtn.addEventListener('click', function () {
        if (playTimer) { stopPlay(); return; }
        let i = 0;
        select(i);
        playBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
        if (typeof setAiState === 'function') {
            setAiState('working', 'Walking through my QA process! 🔍');
        }
        playTimer = setInterval(function () {
            i++;
            if (i >= wfStages.length) {
                stopPlay();
                showComplete();
                if (typeof setAiState === 'function') {
                    setAiState('dancing', 'Quality delivered, every release! ✅');
                }
                return;
            }
            select(i);
        }, 2600);
    });

    function addChip(parent, text, done) {
        const chip = document.createElement('span');
        chip.className = done ? 'wf-chip wf-chip-done' : 'wf-chip';
        chip.textContent = text;
        parent.appendChild(chip);
    }

    function showComplete() {
        nodes.forEach(function (n) {
            n.classList.remove('active');
            n.classList.add('success');
        });
        progress.style.width = '80%';
        elTitle.textContent = 'Workflow Complete';
        elTitle.classList.add('wf-done');
        elDesc.textContent = 'Every stage cleared — requirements traced, defects closed, regression green. This is how quality ships on time, every sprint.';
        elTools.textContent = '';
        addChip(elTools, 'All Stages Passed', true);
        addChip(elTools, 'Zero Open Defects', true);
        elDeliv.textContent = '';
        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-circle-check';
        elDeliv.appendChild(icon);
        elDeliv.appendChild(document.createTextNode(' Status: PRODUCTION READY'));
    }

    select(0);
})();

/* --- FEATURE 4: QA Bug Hunter Game Logic --- */
const certModal = document.getElementById('certModal');
const certRecipient = document.getElementById('certRecipient');
const certDate = document.getElementById('certDate');
let activeBugsCount = 0;
let gameActive = false;

function triggerBugGame() {
    // Clean up any existing bugs and containers to prevent state lock issues
    let container = document.getElementById('bugContainer');
    if (container) {
        container.remove();
    }

    container = document.createElement('div');
    container.id = 'bugContainer';
    container.style.position = 'fixed';
    container.style.inset = '0';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '9998';
    document.body.appendChild(container);

    gameActive = true;
    activeBugsCount = 4;
    setAiState('working', 'QA Bug Hunter activated! Breach detected! 🐛');

    const BugIconClasses = ['fa-solid fa-bug', 'fa-solid fa-bug', 'fa-solid fa-bug', 'fa-solid fa-bug'];
    for (let i = 0; i < 4; i++) {
        setTimeout(() => {
            spawnBug(BugIconClasses[i], i, container);
        }, i * 400);
    }
}

function spawnBug(iconClass, index, container) {
    const bug = document.createElement('i');
    bug.className = `${iconClass} glitch-bug`;
    bug.id = `bug-${index}`;

    const x = Math.random() * 80 + 10;
    const y = Math.random() * 70 + 15;

    bug.style.left = `${x}vw`;
    bug.style.top = `${y}vh`;

    container.appendChild(bug);

    bug.addEventListener('click', (e) => {
        e.stopPropagation();
        squashBug(bug);
    });
}

function squashBug(bug) {
    const rect = bug.getBoundingClientRect();
    createBugExplosion(rect.left + 15, rect.top + 15);
    bug.remove();

    activeBugsCount--;

    if (activeBugsCount > 0) {
        const cheerPhrases = [
            `Glitch squashed! ${activeBugsCount} remaining! 💥`,
            `Bug crushed! Trace eliminated! ⚡`,
            `Target secured! Keep hunting! 🚀`
        ];
        setAiState('working', cheerPhrases[Math.floor(Math.random() * cheerPhrases.length)]);
    } else {
        setAiState('dancing', 'Perimeter Secured! Initializing certificate...');
        gameActive = false;
        const container = document.getElementById('bugContainer');
        if (container) {
            container.remove();
        }
        setTimeout(showCertificate, 1500);
    }
}

function createBugExplosion(x, y) {
    for (let i = 0; i < 10; i++) {
        const p = document.createElement('div');
        p.className = 'bug-particle';
        p.style.left = `${x}px`;
        p.style.top = `${y}px`;

        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 50 + 20;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;

        p.style.setProperty('--dx', `${dx}px`);
        p.style.setProperty('--dy', `${dy}px`);

        document.body.appendChild(p);
        setTimeout(() => p.remove(), 800);
    }
}

function showCertificate() {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    certDate.textContent = `DATE: ${new Date().toLocaleDateString('en-US', options)}`;
    certRecipient.textContent = "ELITE BUG SQUASHER";

    certModal.classList.add('active');
    setAiState('dancing', 'Gold Telemetry Certificate Awarded! 🏆');
}

document.body.addEventListener('click', (e) => {
    if (certModal.classList.contains('active') && !certModal.contains(e.target)) {
        certModal.classList.remove('active');
        setAiState('', 'Bug hunter system offline.');
    }
});

// Certificate modal explicit close button
const certModalClose = document.getElementById('certModalClose');
if (certModalClose) {
    certModalClose.addEventListener('click', (e) => {
        e.stopPropagation();
        certModal.classList.remove('active');
        setAiState('', 'Bug hunter system offline.');
    });
}

// --- CERTIFICATIONS CAROUSEL LOGIC ---
const certsTrack = document.getElementById('certsTrack');
const certPrevBtn = document.getElementById('certPrevBtn');
const certNextBtn = document.getElementById('certNextBtn');
const certDotsContainer = document.getElementById('certsDots');
const certSlides = document.querySelectorAll('.cert-slide');
const certSlicesSelector = document.getElementById('certsSlicesSelector');
let currentCertIndex = 0;

function updateCertCarousel() {
    certsTrack.style.transform = `translateX(-${currentCertIndex * 100}%)`;

    // Update dots
    const dots = certDotsContainer.querySelectorAll('.carousel-dot');
    dots.forEach((dot, idx) => {
        if (idx === currentCertIndex) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });

    // Update slices (tabs)
    const tabs = certSlicesSelector.querySelectorAll('.slice-tab');
    tabs.forEach((tab, idx) => {
        tab.classList.remove('active', 'active-google', 'active-accenture', 'active-india');
        if (idx === currentCertIndex) {
            tab.classList.add('active');
            if (idx === 0) tab.classList.add('active-google');
            else if (idx === 1) tab.classList.add('active-accenture');
            else if (idx === 2) tab.classList.add('active-india');

            // Smoothly scroll tab into focus inside the horizontal slices bar
            const container = certSlicesSelector;
            const leftPos = tab.offsetLeft - (container.offsetWidth / 2) + (tab.offsetWidth / 2);
            container.scrollTo({ left: leftPos, behavior: 'smooth' });
        }
    });
}

certPrevBtn.addEventListener('click', () => {
    currentCertIndex = (currentCertIndex - 1 + certSlides.length) % certSlides.length;
    updateCertCarousel();
    if (!isScriptedMove) setAiState('working', 'Retrieving previous credential...');
});

certNextBtn.addEventListener('click', () => {
    currentCertIndex = (currentCertIndex + 1) % certSlides.length;
    updateCertCarousel();
    if (!isScriptedMove) setAiState('working', 'Retrieving next credential...');
});

certDotsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('carousel-dot')) {
        currentCertIndex = parseInt(e.target.dataset.index);
        updateCertCarousel();
    }
});

// Click Handler for Slices (Tabs) Selector
certSlicesSelector.addEventListener('click', (e) => {
    const tab = e.target.closest('.slice-tab');
    if (tab) {
        currentCertIndex = parseInt(tab.dataset.index);
        updateCertCarousel();
        if (!isScriptedMove) {
            const certNames = ["Google Cloud", "Accenture", "India AI"];
            setAiState('working', `Navigating to ${certNames[currentCertIndex]} credential...`);
        }
    }
});

// Mobile Swipe Gestures
const certsViewport = document.querySelector('.certs-viewport');
let touchStartX = 0;
let touchEndX = 0;
let isSwiping = false;

certsViewport.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    isSwiping = true;
}, { passive: true });

certsViewport.addEventListener('touchend', (e) => {
    if (!isSwiping) return;
    touchEndX = e.changedTouches[0].screenX;
    handleSwipeGesture();
    isSwiping = false;
}, { passive: true });

function handleSwipeGesture() {
    const diffX = touchEndX - touchStartX;
    // Minimum swipe threshold of 50px
    if (Math.abs(diffX) > 50) {
        if (diffX < 0) {
            // Swipe Left -> Next Slide
            currentCertIndex = (currentCertIndex + 1) % certSlides.length;
        } else {
            // Swipe Right -> Previous Slide
            currentCertIndex = (currentCertIndex - 1 + certSlides.length) % certSlides.length;
        }
        updateCertCarousel();
        if (!isScriptedMove) {
            setAiState('working', 'Swiping credential...');
        }
    }
}

// Auto Play Carousel every 8s
let certsAutoPlay = setInterval(() => {
    currentCertIndex = (currentCertIndex + 1) % certSlides.length;
    updateCertCarousel();
}, 8000);

// Pause auto play on hover
const certsSection = document.getElementById('certifications');
if (certsSection) {
    certsSection.addEventListener('mouseenter', () => clearInterval(certsAutoPlay));
    certsSection.addEventListener('mouseleave', () => {
        certsAutoPlay = setInterval(() => {
            currentCertIndex = (currentCertIndex + 1) % certSlides.length;
            updateCertCarousel();
        }, 8000);
    });
}

// Dynamic Certificate Modal Logic
const dynamicCertModal = document.getElementById('dynamicCertModal');
const dynamicCertModalClose = document.getElementById('dynamicCertModalClose');

const certDataStore = {
    'google-cloud': {
        org: 'Google Cloud',
        title: 'Build Search & Recommendation Applications with AI',
        subtitle: 'This credential confirms that Abhinav Saxena has demonstrated proficiency in designing, evaluating, and deploying search and recommendation models powered by Google Cloud GenAI.',
        body: 'Covers Vertex AI, enterprise search architectures, agentic search retrieval, and vector search embeddings for production deployment.',
        date: 'DATE: May 2026',
        credId: 'CREDENTIAL ID: GCP-SRAI-26804',
        sealColor: '#4285F4',
        starColor: '#eab308',
        accentColor: 'rgba(66, 133, 244, 0.25)',
        aiResponse: 'Google Cloud Certified! Enterprise AI search capabilities verified! 🔍'
    },
    'accenture': {
        org: 'Accenture',
        title: 'Reinvention with Agentic AI Learning Program',
        subtitle: 'This certificate validates mastery in orchestrating multi-agent networks, autonomous tool-use pipelines, and LLM-agent reasoning patterns.',
        body: 'Comprehensive training in developing enterprise-grade agentic frameworks, multi-modal prompt tuning, and cognitive AI workflows.',
        date: 'DATE: April 2026',
        credId: 'CREDENTIAL ID: ACN-REAI-84021',
        sealColor: '#A100FF',
        starColor: '#a100ff',
        accentColor: 'rgba(161, 0, 255, 0.25)',
        aiResponse: 'Accenture Agentic AI Specialist! Multi-agent architecture approved! 🤖'
    },
    'india-ai': {
        org: 'India AI (Digital India)',
        title: 'India AI Impact Buildathon 2026',
        subtitle: 'Awarded for developing high-impact AI solutions addressing critical national challenges, showcasing exceptional technical execution and innovation.',
        body: 'Outstanding contribution in deploying localized AI models, ensuring software reliability, and robust QA testing frameworks.',
        date: 'DATE: March 2026',
        credId: 'CREDENTIAL ID: IND-AI-IMPACT-2026',
        sealColor: '#FF9933',
        starColor: '#128807',
        accentColor: 'rgba(255, 153, 51, 0.25)',
        aiResponse: 'India AI Impact Innovator! Exceptional nation-building tech execution! 🏆'
    }
};

function openHoloCert(certId) {
    const data = certDataStore[certId];
    if (!data) return;

    document.getElementById('dynCertOrg').textContent = data.org;
    document.getElementById('dynCertTitle').textContent = data.title;
    document.getElementById('dynCertSubtitle').textContent = data.subtitle;
    document.getElementById('dynCertBody').textContent = data.body;
    document.getElementById('dynCertDate').textContent = data.date;
    document.getElementById('dynCertId').textContent = data.credId;

    const sealStar = document.getElementById('dynCertSealStar');
    const sealIcon = document.getElementById('dynCertSealIcon');

    sealStar.style.color = data.starColor;
    sealIcon.style.color = '#000';

    dynamicCertModal.style.borderColor = data.sealColor;
    dynamicCertModal.style.boxShadow = `0 25px 60px rgba(0,0,0,0.6), 0 0 40px ${data.accentColor}`;

    dynamicCertModal.classList.add('active');

    if (!isScriptedMove) {
        setAiState('dancing', data.aiResponse);
    }
}

if (dynamicCertModalClose) {
    dynamicCertModalClose.addEventListener('click', (e) => {
        e.stopPropagation();
        dynamicCertModal.classList.remove('active');
        if (!isScriptedMove) setAiState('', 'Credential telemetry closed.');
    });
}

// Close modal clicking outside
document.body.addEventListener('click', (e) => {
    if (dynamicCertModal && dynamicCertModal.classList.contains('active') && !dynamicCertModal.contains(e.target) && !e.target.closest('.cert-carousel-card')) {
        dynamicCertModal.classList.remove('active');
        if (!isScriptedMove) setAiState('', '');
    }
});

// --- JOURNEY SECTION ACTIVE SCROLL GLOW LOGIC ---
const journeyItems = document.querySelectorAll('.timeline-item');

const journeyOptions = {
    threshold: 0.5,
    rootMargin: "0px 0px -15% 0px"
};

const journeyObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            // Remove active, add soft-focus to all
            journeyItems.forEach(item => {
                item.classList.remove('active-focus');
                item.classList.add('soft-focus');
            });

            // Highlight the focused one
            entry.target.classList.add('active-focus');
            entry.target.classList.remove('soft-focus');

            // Dynamically interact with AI Companion
            if (typeof isScriptedMove !== 'undefined' && !isScriptedMove) {
                if (entry.target.id === 'journey-accenture') {
                    setAiState('working', 'Checking Accenture logs: 2+ Years QA Telemetry verified! 🏢');
                } else if (entry.target.id === 'journey-lpu') {
                    setAiState('dancing', 'BCA Engineering credentials verified at LPU! 🎓');
                }
            }
        }
    });
}, journeyOptions);

journeyItems.forEach(item => {
    journeyObserver.observe(item);
});

// Theme Toggle Logic
const themeToggle = document.getElementById('themeToggle');
const themeIcon = themeToggle.querySelector('i');

const savedTheme = localStorage.getItem('theme') || 'dark';
if (savedTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    themeIcon.className = 'fa-solid fa-moon';
}

themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    let newTheme = 'dark';
    if (currentTheme !== 'light') {
        newTheme = 'light';
    }

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    if (newTheme === 'light') {
        themeIcon.className = 'fa-solid fa-moon';
        setAiState('working', 'Light Mode Engaged!');
    } else {
        themeIcon.className = 'fa-solid fa-sun';
        setAiState('dancing', 'Dark Mode Restored!');
    }
});



// ===== Hero Typewriter =====
(function () {
    const el = document.getElementById('typewriterText');
    if (!el) return;
    const roles = ['QA Tester', 'Automation Engineer', 'AI Builder', 'Accessibility Advocate'];
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        el.textContent = roles[0];
        return;
    }
    let roleIdx = 0, charIdx = roles[0].length, deleting = true;
    function tick() {
        const word = roles[roleIdx];
        if (deleting) {
            charIdx--;
            el.textContent = word.slice(0, charIdx);
            if (charIdx === 0) {
                deleting = false;
                roleIdx = (roleIdx + 1) % roles.length;
                setTimeout(tick, 350);
                return;
            }
            setTimeout(tick, 45);
        } else {
            charIdx++;
            el.textContent = roles[roleIdx].slice(0, charIdx);
            if (charIdx === roles[roleIdx].length) {
                deleting = true;
                setTimeout(tick, 2200);
                return;
            }
            setTimeout(tick, 90);
        }
    }
    setTimeout(tick, 2200);
})();

// ===== Animated Stats Counters =====
(function () {
    const nums = document.querySelectorAll('.stat-num[data-count]');
    if (!nums.length) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function animate(el) {
        const target = parseInt(el.dataset.count, 10);
        const suffix = el.dataset.suffix || '';
        if (reduced) {
            el.textContent = target + suffix;
            return;
        }
        const duration = 1400;
        const start = performance.now();
        function frame(now) {
            const p = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.round(target * eased) + suffix;
            if (p < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    const counterObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animate(entry.target);
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    nums.forEach(n => counterObserver.observe(n));
})();

// ===== Scroll-Drawn Timeline SVG Path =====
(function () {
    const timeline = document.querySelector('.timeline');
    if (!timeline) return;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'timeline-path-svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML =
        '<defs><linearGradient id="tlGrad" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#8b5cf6"/>' +
        '<stop offset="55%" stop-color="#3b82f6"/>' +
        '<stop offset="100%" stop-color="#ec4899"/>' +
        '</linearGradient></defs>' +
        '<path class="tl-track"/><path class="tl-draw"/>' +
        '<circle class="timeline-path-tip" r="6" opacity="0"/>';
    timeline.appendChild(svg);
    timeline.classList.add('has-path');

    const track = svg.querySelector('.tl-track');
    const draw = svg.querySelector('.tl-draw');
    const tip = svg.querySelector('.timeline-path-tip');
    let pathLen = 0;

    function buildPath() {
        const h = timeline.offsetHeight;
        const cx = window.innerWidth <= 768 ? 1 : 21;
        const amp = 13;
        const seg = 170;
        let d = 'M ' + cx + ' 0';
        let y = 0, dir = 1;
        while (y < h) {
            const ny = Math.min(y + seg, h);
            d += ' Q ' + (cx + amp * dir) + ' ' + (y + (ny - y) / 2) + ' ' + cx + ' ' + ny;
            y = ny;
            dir *= -1;
        }
        track.setAttribute('d', d);
        draw.setAttribute('d', d);
        pathLen = draw.getTotalLength();
        draw.style.strokeDasharray = pathLen;
        draw.style.strokeDashoffset = pathLen;
    }

    function updateDraw() {
        if (!pathLen) return;
        const rect = timeline.getBoundingClientRect();
        const vh = window.innerHeight;
        const total = rect.height + vh * 0.45;
        const passed = (vh * 0.85) - rect.top;
        const p = Math.max(0, Math.min(1, passed / total));
        draw.style.strokeDashoffset = pathLen * (1 - p);
        const pt = draw.getPointAtLength(pathLen * p);
        tip.setAttribute('cx', pt.x);
        tip.setAttribute('cy', pt.y);
        tip.setAttribute('opacity', p > 0.01 && p < 0.99 ? '1' : '0');
    }

    buildPath();

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        draw.style.strokeDashoffset = 0;
        return;
    }

    window.addEventListener('scroll', updateDraw, { passive: true });
    window.addEventListener('resize', function () { buildPath(); updateDraw(); });
    updateDraw();
})();

// ===== Hero Signature Draw =====
(function () {
    const fill = document.querySelector('.sig-fill');
    const stroke = document.querySelector('.sig-stroke');
    if (!fill || !stroke) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    fill.style.opacity = '0';
    stroke.style.opacity = '1';

    const ready = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    ready.then(function () {
        const dash = 600;
        stroke.style.strokeDasharray = dash;
        stroke.style.strokeDashoffset = dash;
        const dur = 2400;
        const start = performance.now();
        function frame(now) {
            const p = Math.min((now - start) / dur, 1);
            stroke.style.strokeDashoffset = dash * (1 - p);
            if (p < 1) {
                requestAnimationFrame(frame);
            } else {
                fill.style.transition = 'opacity 0.9s ease';
                fill.style.opacity = '1';
                stroke.style.transition = 'opacity 0.9s ease';
                stroke.style.opacity = '0';
            }
        }
        requestAnimationFrame(frame);
    });
})();

// ===== Skill Rings (animate on card flip) =====
(function () {
    const CIRC = 263.9;
    const rings = document.querySelectorAll('.ring-fill');
    if (!rings.length) return;

    function setFinal(ring) {
        const pct = parseInt(ring.dataset.pct, 10);
        ring.style.strokeDasharray = CIRC;
        ring.style.strokeDashoffset = CIRC * (1 - pct / 100);
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        rings.forEach(setFinal);
        return;
    }

    rings.forEach(function (r) {
        r.style.strokeDasharray = CIRC;
        r.style.strokeDashoffset = CIRC;
    });

    const running = new WeakMap();

    function animateCard(card) {
        card.querySelectorAll('.ring-fill').forEach(function (ring) {
            if (running.get(ring)) cancelAnimationFrame(running.get(ring));
            const pct = parseInt(ring.dataset.pct, 10);
            const dur = 1200;
            const start = performance.now();
            function frame(now) {
                const p = Math.min((now - start) / dur, 1);
                const eased = 1 - Math.pow(1 - p, 3);
                ring.style.strokeDashoffset = CIRC * (1 - (pct / 100) * eased);
                if (p < 1) running.set(ring, requestAnimationFrame(frame));
            }
            running.set(ring, requestAnimationFrame(frame));
        });
    }

    document.querySelectorAll('.skill-card.flip-card').forEach(function (card) {
        card.addEventListener('mouseenter', function () { animateCard(card); });
        card.addEventListener('click', function () { animateCard(card); });
    });
})();

// ===== Section Title Flourish (drawn underline on reveal) =====
(function () {
    const svgNS = 'http://www.w3.org/2000/svg';
    document.querySelectorAll('.section-title').forEach(function (title) {
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('class', 'title-flourish');
        svg.setAttribute('viewBox', '0 0 140 14');
        svg.setAttribute('width', '140');
        svg.setAttribute('height', '14');
        svg.setAttribute('aria-hidden', 'true');
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', 'M 4 8 Q 40 2 70 8 Q 100 14 136 8');
        svg.appendChild(path);
        title.appendChild(svg);
    });
})();


// ===== Section Dots Navigator (right side) =====
(function () {
    const sectionMap = [
        ['home', 'Home'],
        ['about', 'About'],
        ['skills', 'Skills'],
        ['projects', 'Projects'],
        ['pipeline', 'Workflow'],
        ['experience', 'Journey'],
        ['certifications', 'Certifications'],
        ['contact', 'Contact']
    ];
    const wrap = document.createElement('nav');
    wrap.className = 'section-dots';
    wrap.setAttribute('aria-label', 'Section navigation');
    const dots = [];

    sectionMap.forEach(function (pair) {
        const sec = document.getElementById(pair[0]);
        if (!sec) return;
        const dot = document.createElement('button');
        dot.className = 'section-dot';
        dot.setAttribute('aria-label', 'Go to ' + pair[1]);
        const label = document.createElement('span');
        label.className = 'dot-label';
        label.textContent = pair[1];
        dot.appendChild(label);
        dot.addEventListener('click', function () {
            sec.scrollIntoView({ behavior: 'smooth' });
        });
        wrap.appendChild(dot);
        dots.push([dot, sec]);
    });

    if (!dots.length) return;
    document.body.appendChild(wrap);

    function updateDots() {
        let currentIdx = 0;
        dots.forEach(function (pair, idx) {
            if (window.scrollY >= pair[1].offsetTop - 150) currentIdx = idx;
        });
        dots.forEach(function (pair, idx) {
            pair[0].classList.toggle('active', idx === currentIdx);
        });
    }

    window.addEventListener('scroll', updateDots, { passive: true });
    updateDots();
})();

// ===== Email Copy Button =====
(function () {
    const btn = document.getElementById('copyEmailBtn');
    if (!btn) return;
    const icon = btn.querySelector('i');
    let resetTimer = null;
    btn.addEventListener('click', function () {
        const email = btn.dataset.email;
        function onCopied() {
            btn.classList.add('copied');
            icon.className = 'fa-solid fa-check';
            btn.title = 'Copied!';
            if (typeof setAiState === 'function') {
                setAiState('dancing', 'Email copied to clipboard! 📋');
            }
            clearTimeout(resetTimer);
            resetTimer = setTimeout(function () {
                btn.classList.remove('copied');
                icon.className = 'fa-regular fa-copy';
                btn.title = 'Copy email';
            }, 2200);
        }
        function legacyCopy() {
            const ta = document.createElement('textarea');
            ta.value = email;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            onCopied();
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(email).then(onCopied).catch(legacyCopy);
        } else {
            legacyCopy();
        }
    });
})();

// ===== Preloader Dismiss =====
(function () {
    const pre = document.getElementById('preloader');
    if (!pre || pre.style.display === 'none') return;
    const MIN_SHOW = 900;
    const start = performance.now();
    function hide() {
        const wait = Math.max(0, MIN_SHOW - (performance.now() - start));
        setTimeout(function () {
            pre.classList.add('done');
            try { sessionStorage.setItem('avSeen', '1'); } catch (e) { }
            setTimeout(function () { pre.remove(); }, 600);
        }, wait);
    }
    if (document.readyState === 'complete') {
        hide();
    } else {
        window.addEventListener('load', hide);
        setTimeout(hide, 2200);
    }
})();
