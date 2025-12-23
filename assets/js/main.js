const canvas = document.getElementById('galaxyCanvas');
const ctx = canvas.getContext('2d');
let width, height, particles;
let backgroundStars = [];
let snowMounds = [];
let mountains = [];
let isExploded = false;
let explodeTimer = null;
let audioCtx = null;
let dpr = window.devicePixelRatio || 1;
let meAlpha = 1;
let meFadeStartTime = null;
let hasSupernovaed = false;
const supernovaDuration = 2500;
const meFadeDuration = 800;


const meImage = new Image();
let meImageLoaded = false;
let meImageSize = { width: 0, height: 0 };
const bubbleImage = new Image();
let bubbleImageLoaded = false;
let bubbleImageSize = { width: 0, height: 0 };
meImage.onload = () => {
    meImageLoaded = true;
    meImageSize = {
        width: meImage.naturalWidth || meImage.width,
        height: meImage.naturalHeight || meImage.height
    };
};
meImage.src = './image/Me.png';
bubbleImage.onload = () => {
    bubbleImageLoaded = true;
    bubbleImageSize = {
        width: bubbleImage.naturalWidth || bubbleImage.width,
        height: bubbleImage.naturalHeight || bubbleImage.height
    };
};
bubbleImage.src = './image/speech-bubble.png';

const dialogues = [
    'Giáng sinh an lành nhé cả nhà ơi!🎄✨',
    'Cảm ơn mọi người vì đã luôn ở bên cạnh và sẻ chia cùng Cường mọi buồn vui trong năm vừa qua. 😍',
    'Chúc mọi người một đêm Noel ấm áp và một năm mới tràn đầy sức khỏe, niềm vui và thật nhiều may mắn.🎉🎊',
    'Yêu tất cả mọi người! ❤️'
];
let dialogueIndex = 0;
let supernovaUnlocked = false;
let hideBubble = false;
let isJumping = false;
let jumpHeight = 0;
let jumpVelocity = 0;
const jumpStartVelocity = 300;   // px/s upward
const jumpGravity = -2600;       // px/s^2 downward
let lastFrameTime = null;

// Particle speed control (slow before supernova)
let particleSpeedScale = 0.15;

const particleCount = 4000;
const colors = ['#00FF66', '#00A843', '#FF0000', '#FFF200', '#FFF200', '#00EEFF'];
const backgroundStarCount = 1800;

function init() {
    resizeCanvas();
    particles = Array.from({ length: particleCount }, () => new Particle());
    backgroundStars = Array.from({ length: backgroundStarCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 0.5 + 0.6,
        phase: Math.random() * Math.PI,
        speed: 0.001 + Math.random() * 0.002,
        baseAlpha: 0.01 + Math.random() * 0.2
    }));
    mountains = generateMountains();
    snowMounds = generateSnowMounds();
}

function resizeCanvas() {
    dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    width = window.innerWidth;
    height = window.innerHeight;
}


function playExplosionSound() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 1.5);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 1.5);
}

class Particle {
    constructor() {
        this.reset();
        this.x = (Math.random() - 0.5) * width;
        this.y = (Math.random() - 0.5) * height;
    }

    reset() {
        this.angle = Math.random() * Math.PI * 2;
        this.maxRadius = Math.random() * 280;
        this.treeY = Math.random() * 550;
        this.speed = 0.01 + Math.random() * 0.02;
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.size = Math.random() * 1.8;
        this.setExplosionVelocity();
    }

    setExplosionVelocity() {
        this.vx = (Math.random() - 0.5) * 50;
        this.vy = (Math.random() - 0.5) * 50;
    }

    update() {
        // Move slowly before supernova, normal speed after
        const speedScale = hasSupernovaed ? 1 : particleSpeedScale;

        this.angle += this.speed * speedScale;
        const taper = 1 - this.treeY / 550;
        const targetX = Math.cos(this.angle) * (this.maxRadius * taper);
        const targetY = -this.treeY + 200;

        if (!isExploded) {
            const lerpFactor = 0.08 * speedScale;
            this.x += (targetX - this.x) * lerpFactor;
            this.y += (targetY - this.y) * lerpFactor;
        } else {
            this.x += this.vx;
            this.y += this.vy;
            this.vx *= 0.98;
            this.vy *= 0.98;
        }
    }

    draw() {
        const renderX = width / 2 + this.x;
        const renderY = height * 0.7 + this.y;
        ctx.beginPath();
        ctx.arc(renderX, renderY, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}

function drawGround() {
    const groundTop = height * 0.8;

    drawMountains(groundTop);

    // Simple dark gradient ground to make the tree pop
    const grad = ctx.createLinearGradient(0, groundTop, 0, height);
    grad.addColorStop(0, '#111111');   // top
    grad.addColorStop(0.5, '#080808'); // mid
    grad.addColorStop(1, '#000000');   // bottom
    ctx.fillStyle = grad;
    ctx.fillRect(0, groundTop, width, height - groundTop);
}

function drawMountains(groundTop) {
    if (!mountains || mountains.length === 0) return;
    ctx.save();
    ctx.fillStyle = '#0d0d0f';
    ctx.strokeStyle = '#16161a';
    ctx.lineWidth = 2;
    mountains.forEach(m => {
        ctx.beginPath();
        ctx.moveTo(m.x, groundTop);
        ctx.lineTo(m.x + m.width * 0.5, groundTop - m.height);
        ctx.lineTo(m.x + m.width, groundTop);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    });
    ctx.restore();
}

function generateMountains() {
    const count = Math.max(3, Math.floor(width / 450));
    const mountainsArr = [];
    const baseWidth = width / count;
    for (let i = 0; i < count; i++) {
        const widthVar = baseWidth * (0.8 + Math.random() * 0.8);
        const heightVar = height * (0.12 + Math.random() * 0.08);
        const x = i * baseWidth - baseWidth * 0.2 + Math.random() * baseWidth * 0.4;
        mountainsArr.push({ x, width: widthVar, height: heightVar });
    }
    return mountainsArr;
}

function generateSnowMounds() {
    const moundCount = Math.max(6, Math.floor(width / 180));
    const mounds = [];
    const baseWidth = width / moundCount;
    for (let i = 0; i < moundCount; i++) {
        const w = baseWidth * (0.6 + Math.random() * 0.8);
        const h = (30 + Math.random() * 60);
        const x = i * baseWidth + Math.random() * baseWidth * 0.4;
        mounds.push({ x, w, h });
    }
    return mounds;
}

function drawStar() {
    if (isExploded) return;
    ctx.save();
    ctx.translate(width / 2, height * 0.7 - 360);
    ctx.rotate(Math.PI);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        ctx.rotate(Math.PI / 5);
        ctx.lineTo(0, -25 - Math.sin(Date.now() * 0.005) * 5);
        ctx.rotate(Math.PI / 5);
        ctx.lineTo(0, -10);
    }
    ctx.fillStyle = '#fff700';
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#fff700';
    ctx.fill();
    ctx.restore();
}

function drawBackgroundStars() {
    const t = Date.now();
    ctx.save();
    backgroundStars.forEach(star => {
        const twinkle = 0.5 + 0.5 * Math.sin(t * star.speed + star.phase);
        ctx.globalAlpha = star.baseAlpha + 0.2 * twinkle;
        ctx.fillStyle = '#b3f0ff';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

function drawMe() {
    if (!meImageLoaded || hasSupernovaed) return;
    const alpha = Math.max(0, Math.min(1, meAlpha));
    if (alpha <= 0) return;
    const maxHeight = Math.min(height * 0.35, 180);
    const aspectRatio = meImageSize.width && meImageSize.height ? meImageSize.width / meImageSize.height : 1;
    const drawHeight = maxHeight;
    const drawWidth = drawHeight * aspectRatio;
    const baseY = height * 0.85;
    // Keep Me anchored closer to the tree on wide screens; reduce drift on mobile/desktop
    const sideOffset = Math.min(Math.max(width * 0.08, 110), 220);
    const lift = Math.max(height * 0.02, 18);
    
    // Breathing effect - subtle scale animation
    const breathingSpeed = 0.002;
    const breathingAmount = 0.02; // 2% scale variation
    const breathingScale = 1 + Math.sin(Date.now() * breathingSpeed) * breathingAmount;
    
    const x = width / 2 + sideOffset;
    const y = baseY - drawHeight + lift - jumpHeight;
    const centerX = x + drawWidth * 0.5;
    const centerY = y + drawHeight * 0.5;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 18;
    ctx.translate(centerX, centerY);
    ctx.scale(breathingScale, breathingScale);
    ctx.translate(-centerX, -centerY);
    ctx.drawImage(meImage, x, y, drawWidth, drawHeight);
    ctx.restore();

    if (!hideBubble && dialogueIndex < dialogues.length) {
        drawSpeechBubble(dialogues[dialogueIndex], x, y, drawWidth, drawHeight);
    }
}

function drawSpeechBubble(text, meX, meY, meWidth, meHeight) {
    // Render text only (no bubble image) above the head
    const padding = 10;
    const textMaxWidth = Math.max(140, Math.min(width * 0.4, 260));
    const fontSize = Math.max(18, Math.min(24, width * 0.02)); // Larger font
    const lineHeight = fontSize + 5;

    const lines = wrapText(text, textMaxWidth);
    const textHeight = lines.length * lineHeight;

    const margin = 12;
    const desiredX = meX + meWidth * 0.1 + padding;
    const textX = Math.max(margin, Math.min(desiredX, width - textMaxWidth - margin));
    // Lift further based on total text height so longer text doesn't overlap Me
    const textY = meY - 5 - textHeight;

    ctx.save();
    ctx.font = `${fontSize}px "Arial", sans-serif`;
    
    // Draw black outline
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    
    lines.forEach((line, idx) => {
        ctx.strokeText(line, textX, textY + lineHeight * idx);
    });
    
    // Draw white fill
    ctx.fillStyle = '#FFFFFF';
    lines.forEach((line, idx) => {
        ctx.fillText(line, textX, textY + lineHeight * idx);
    });
    
    ctx.restore();
}

function wrapText(text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let current = '';
    words.forEach(word => {
        const testLine = current.length > 0 ? `${current} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && current.length > 0) {
            lines.push(current);
            current = word;
        } else {
            current = testLine;
        }
    });
    if (current.length > 0) lines.push(current);
    return lines;
}

function animate() {
    // Use timestamp to keep jump physics consistent
    const now = performance.now();
    if (lastFrameTime === null) lastFrameTime = now;
    const dt = Math.min(0.05, (now - lastFrameTime) / 1000); // clamp to avoid big steps
    lastFrameTime = now;

    updateJump(dt);
    updateMeFade(now);

    ctx.fillStyle = 'rgba(5, 5, 16, 0.2)';
    ctx.fillRect(0, 0, width, height);
    drawBackgroundStars();
    drawGround();
    particles.forEach(particle => {
        particle.update();
        particle.draw();
    });
    drawStar();
    drawMe();
    requestAnimationFrame(animate);
}

function updateJump(dt) {
    if (!isJumping) return;

    jumpVelocity += jumpGravity * dt;
    jumpHeight = Math.max(0, jumpHeight + jumpVelocity * dt);

    if (jumpHeight <= 0) {
        jumpHeight = 0;
        jumpVelocity = 0;
        isJumping = false;
    }
}

function updateMeFade(now) {
    if (meFadeStartTime === null) return;
    const elapsed = now - meFadeStartTime;
    if (elapsed <= 0) {
        meAlpha = 1;
        return;
    }
    const t = Math.min(1, elapsed / meFadeDuration);
    meAlpha = 1 - t;
}

function triggerSupernova() {
    if (isExploded) return;
    isExploded = true;
    hasSupernovaed = true;
    particleSpeedScale = 1; // Restore full speed after supernova
    particles.forEach(p => p.setExplosionVelocity());
    playExplosionSound();
    if (explodeTimer) clearTimeout(explodeTimer);
    explodeTimer = setTimeout(() => {
        isExploded = false;
    }, supernovaDuration);
    hideBubble = true;
    meFadeStartTime = performance.now(); // start fading immediately
    meAlpha = 1;
}

function handleClick() {
    // Prevent spam: only allow when landed
    if (isJumping) return;

    // Start jump
    isJumping = true;
    jumpVelocity = jumpStartVelocity;
    jumpHeight = 0;

    if (!supernovaUnlocked) {
        if (dialogueIndex < dialogues.length - 1) {
            dialogueIndex += 1;
            if (dialogueIndex === dialogues.length - 1) {
                supernovaUnlocked = true;
            }
            return;
        }
        supernovaUnlocked = true;
        return;
    }

    triggerSupernova();
}

window.addEventListener('mousedown', handleClick);
window.addEventListener('touchstart', handleClick, { passive: true });

window.addEventListener('resize', () => {
    resizeCanvas();
    mountains = generateMountains();
    snowMounds = generateSnowMounds();
});

init();
animate();

// Prevent clicks on audio widget from triggering Me interaction
function setupAudioWidgetClickBlock() {
    const audioWidget = document.querySelector('.audio-widget');
    if (audioWidget) {
        audioWidget.addEventListener('mousedown', function(e) {
            e.stopPropagation();
        });
        audioWidget.addEventListener('touchstart', function(e) {
            e.stopPropagation();
        }, { passive: true });
    } else {
        setTimeout(setupAudioWidgetClickBlock, 100);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAudioWidgetClickBlock);
} else {
    setupAudioWidgetClickBlock();
}

// Initialize AmplitudeJS player
function initAmplitudePlayer() {
    if (typeof Amplitude === 'undefined') {
        setTimeout(initAmplitudePlayer, 100);
        return;
    }

    const songs = [
        {
            name: 'Santa Tell Me',
            artist: 'Christmas Classics',
            url: './assets/songs/Santa Tell Me.mp3',
            cover_art_url: ''
        },
        {
            name: 'Feliz Navidad',
            artist: 'Christmas Classics',
            url: './assets/songs/Feliz Navidad.mp3',
            cover_art_url: ''
        },
        {
            name: 'Happy Xmas (War Is Over)',
            artist: 'Christmas Classics',
            url: './assets/songs/Happy Xmas (War Is Over).mp3',
            cover_art_url: ''
        },
        {
            name: 'It\'s The Most Wonderful Time Of The Year',
            artist: 'Christmas Classics',
            url: './assets/songs/It\'S The Most Wonderful Time Of The Year.mp3',
            cover_art_url: ''
        },
        {
            name: 'Last Christmas',
            artist: 'Christmas Classics',
            url: './assets/songs/Last Christmas (Single Version).mp3',
            cover_art_url: ''
        },
        {
            name: 'Let It Snow! Let It Snow! Let It Snow!',
            artist: 'Christmas Classics',
            url: './assets/songs/Let It Snow! Let It Snow! Let It Snow!.mp3',
            cover_art_url: ''
        },
        {
            name: 'Merry Christmas Everyone',
            artist: 'Christmas Classics',
            url: './assets/songs/Merry Christmas Everyone.mp3',
            cover_art_url: ''
        },
    ];

    Amplitude.init({
        songs: songs,
        playlists: {
            'christmas-playlist': {
                songs: [0, 1, 2, 3, 4, 5, 6],
                title: 'Christmas Playlist'
            }
        },
        default_album_art: '',
        callbacks: {
            timeupdate: function() {
                const currentTime = Amplitude.getCurrentTime();
                const duration = Amplitude.getDuration();
                if (duration > 0) {
                    Amplitude.setSongPlayedPercentage((currentTime / duration) * 100);
                }
            }
        }
    });

    // Manual event bindings to ensure they work
    const playPauseBtn = document.querySelector('.play-pause');
    const prevBtn = document.querySelector('[data-amplitude-previous]');
    const nextBtn = document.querySelector('[data-amplitude-next]');

    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (Amplitude.getPlayerState() === 'playing') {
                Amplitude.pause();
            } else {
                Amplitude.play();
            }
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', function(e) {
            e.preventDefault();
            Amplitude.prev();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', function(e) {
            e.preventDefault();
            Amplitude.next();
        });
    }

    // Auto play after initialization
    setTimeout(function() {
        Amplitude.setActivePlaylist('christmas-playlist');
        Amplitude.play();
    }, 300);
}

// Wait for AmplitudeJS to load
window.addEventListener('load', function() {
    setTimeout(initAmplitudePlayer, 200);
});
