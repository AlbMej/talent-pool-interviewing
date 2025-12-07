// Application state
interface Question {
    id: number;
    text: string;
    asked: boolean;
    skipped: boolean;
}

interface TranscriptEntry {
    timestamp: string;
    text: string;
}

interface SkillNode {
    name: string;
    type?: string;
    children?: SkillNode[];
    progress?: number;
}

interface AppState {
    sidebarCollapsed: boolean;
    isRecording: boolean;
    isMuted: boolean;
    recordingTime: number;
    recordingInterval: ReturnType<typeof setInterval> | null;
    videoStream: MediaStream | null;
    recommendedQuestions: Question[];
    questionsCollapsed: boolean;
    isLoadingQuestions: boolean;
    questionHistory: Array<{ id: number; text: string; timestamp: string }>;
    transcript: TranscriptEntry[];
    skillTree: SkillNode | null;
    skillProgress: Map<string, number>;
    waveformAnimationFrame: number | null;
    lastProcessedIndex: number;
}

// Declare D3 types
declare const d3: any;

// Application state
const state: AppState = {
    sidebarCollapsed: false,
    isRecording: false,
    isMuted: false,
    recordingTime: 0,
    recordingInterval: null,
    videoStream: null,
    recommendedQuestions: [],
    questionsCollapsed: false,
    isLoadingQuestions: false,
    questionHistory: [],
    transcript: [
        { timestamp: '15:49:03', text: "Hey my name is Thomas Uh I'm a junior engineer and I use React" }
    ],
    skillTree: null,
    skillProgress: new Map(),
    waveformAnimationFrame: null,
    lastProcessedIndex: 0
};

// DOM elements
const elements = {
    sidebar: document.getElementById('sidebar')!,
    sidebarToggle: document.getElementById('sidebarToggle')!,
    questionsToggle: document.getElementById('questionsToggle')!,
    questionsIcon: document.getElementById('questionsIcon')!,
    questionsContainer: document.getElementById('questionsContainer')!,
    questionsLoading: document.getElementById('questionsLoading')!,
    questionsList: document.getElementById('questionsList')!,
    questionHistory: document.getElementById('questionHistory')!,
    videoElement: document.getElementById('videoElement') as HTMLVideoElement,
    noVideo: document.getElementById('noVideo')!,
    transcriptContainer: document.getElementById('transcriptContainer')!,
    waveform: document.getElementById('waveform')!,
    recordButton: document.getElementById('recordButton')!,
    recordIcon: document.getElementById('recordIcon')!,
    recordText: document.getElementById('recordText')!,
    muteButton: document.getElementById('muteButton')!,
    muteIcon: document.getElementById('muteIcon')!,
    skillTreeContainer: document.getElementById('skillTreeContainer')!
};

let skillTreeViz: any = null;

// Initialize waveform bars
function initWaveform(): void {
    const waveform = elements.waveform;
    waveform.innerHTML = '';
    for (let i = 0; i < 20; i++) {
        const bar = document.createElement('div');
        bar.className = 'waveform-bar';
        bar.style.height = '20%';
        waveform.appendChild(bar);
    }
}

// Animate waveform
function animateWaveform(): void {
    if (!state.isRecording) {
        const bars = elements.waveform.querySelectorAll('.waveform-bar');
        bars.forEach((bar: HTMLElement) => {
            bar.style.height = '20%';
            bar.classList.remove('active');
        });
        if (state.waveformAnimationFrame) {
            cancelAnimationFrame(state.waveformAnimationFrame);
            state.waveformAnimationFrame = null;
        }
        return;
    }

    function animate() {
        if (!state.isRecording) return;
        
        const bars = elements.waveform.querySelectorAll('.waveform-bar');
        for (let i = 0; i < 3; i++) {
            const index = Math.floor(Math.random() * 20);
            const height = Math.random() * 100;
            (bars[index] as HTMLElement).style.height = `${height}%`;
            bars[index].classList.add('active');
        }
        
        state.waveformAnimationFrame = requestAnimationFrame(animate);
    }
    
    animate();
}

// Format time
function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Initialize video stream
async function initVideoStream(): Promise<void> {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        state.videoStream = stream;
        elements.videoElement.srcObject = stream;
        elements.noVideo.style.display = 'none';
    } catch (error) {
        console.error('Error accessing media devices:', error);
        elements.noVideo.style.display = 'flex';
    }
}

// Toggle recording
function toggleRecording(): void {
    if (state.isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording(): void {
    if (!state.videoStream && elements.videoElement) {
        initVideoStream();
    }
    state.isRecording = true;
    state.recordingTime = 0;
    
    if (state.recordingInterval) {
        clearInterval(state.recordingInterval);
    }
    
    state.recordingInterval = setInterval(() => {
        if (state.isRecording) {
            state.recordingTime++;
            updateRecordButton();
            updateQuestionsOnRecordingChange();
        }
    }, 1000);
    
    animateWaveform();
    updateRecordButton();
    updateQuestionsOnRecordingChange();
}

function stopRecording(): void {
    state.isRecording = false;
    if (state.recordingInterval) {
        clearInterval(state.recordingInterval);
        state.recordingInterval = null;
    }
    animateWaveform();
    updateRecordButton();
    updateQuestionsOnRecordingChange();
}

function updateRecordButton(): void {
    if (state.isRecording) {
        elements.recordButton.classList.add('destructive');
        elements.recordIcon.className = 'fas fa-stop';
        elements.recordText.textContent = `Stop ${formatTime(state.recordingTime)}`;
    } else {
        elements.recordButton.classList.remove('destructive');
        elements.recordIcon.className = 'fas fa-pause';
        elements.recordText.textContent = 'Start';
    }
}

// Toggle mute
function toggleMute(): void {
    state.isMuted = !state.isMuted;
    if (state.videoStream) {
        state.videoStream.getAudioTracks().forEach(track => {
            track.enabled = !state.isMuted;
        });
    }
    updateMuteButton();
}

function updateMuteButton(): void {
    if (state.isMuted) {
        elements.muteButton.classList.add('secondary');
        elements.muteButton.classList.remove('outline');
        elements.muteIcon.className = 'fas fa-microphone-slash';
    } else {
        elements.muteButton.classList.remove('secondary');
        elements.muteButton.classList.add('outline');
        elements.muteIcon.className = 'fas fa-microphone';
    }
}

// Load skill tree
async function loadSkillTree(): Promise<void> {
    const urlParams = new URLSearchParams(window.location.search);
    const jobId = urlParams.get('job_id');
    
    try {
        let skillTreeData: SkillNode | null = null;
        
        if (jobId) {
            try {
                const response = await fetch(`http://localhost:5000/api/v1/skill-trees/${jobId}`);
                if (response.ok) {
                    skillTreeData = await response.json();
                }
            } catch (e) {
                console.warn('Server endpoint not available, loading default');
            }
        }
        
        if (!skillTreeData) {
            try {
                const response = await fetch('http://localhost:5000/api/v1/skill-trees/default');
                if (response.ok) {
                    skillTreeData = await response.json();
                }
            } catch (e) {
                skillTreeData = getDefaultSkillTree();
            }
        }
        
        state.skillTree = skillTreeData;
        initializeSkillProgress(skillTreeData);
        renderSkillTree(skillTreeData);
        await generateQuestionsFromSkillTree(skillTreeData);
    } catch (error) {
        console.error('Failed to load skill tree:', error);
        const defaultTree = getDefaultSkillTree();
        state.skillTree = defaultTree;
        initializeSkillProgress(defaultTree);
        renderSkillTree(defaultTree);
        await generateQuestionsFromSkillTree(defaultTree);
    }
}

function getDefaultSkillTree(): SkillNode {
    return {
        name: "Skills",
        children: [
            {
                name: "Technical Skills",
                children: [
                    {
                        name: "Programming Languages",
                        children: [
                            { name: "Python", type: "skill" },
                            { name: "Rust", type: "skill" }
                        ]
                    },
                    {
                        name: "Frameworks",
                        children: [
                            { name: "Jax", type: "skill" }
                        ]
                    },
                    {
                        name: "Technologies",
                        children: [
                            { name: "large-scale distributed machine learning systems", type: "skill" }
                        ]
                    }
                ]
            },
            {
                name: "ML/AI Concepts",
                children: [
                    { name: "fine-tuning large language models", type: "skill" },
                    { name: "reinforcement learning", type: "skill" },
                    { name: "reward models", type: "skill" },
                    { name: "model evaluation", type: "skill" },
                    { name: "inference-time search techniques", type: "skill" },
                    { name: "model optimizations", type: "skill" }
                ]
            },
            {
                name: "Methodologies & Techniques",
                children: [
                    { name: "data collection pipelines", type: "skill" },
                    { name: "data generation techniques", type: "skill" },
                    { name: "reinforcement learning algorithms", type: "skill" },
                    { name: "model training frameworks", type: "skill" }
                ]
            },
            {
                name: "Domain Expertise",
                children: [
                    { name: "post-training", type: "skill" },
                    { name: "pre-training", type: "skill" },
                    { name: "reasoning", type: "skill" },
                    { name: "multimodal", type: "skill" }
                ]
            }
        ],
        job_id: 4374125007,
        job_title: "Member of Technical Staff, Post-training",
        location: "Palo Alto, CA; San Francisco, CA"
    } as SkillNode & { job_id?: number; job_title?: string; location?: string };
}

function initializeSkillProgress(node: SkillNode): void {
    if (node.type === 'skill' || node.type === 'requirement') {
        state.skillProgress.set(node.name, 0);
    }
    if (node.children) {
        node.children.forEach(child => initializeSkillProgress(child));
    }
}

// Generate questions from skill tree
async function generateQuestionsFromSkillTree(tree: SkillNode): Promise<void> {
    state.isLoadingQuestions = true;
    elements.questionsLoading.style.display = 'block';
    elements.questionsList.innerHTML = '';
    
    try {
        const skills: string[] = [];
        function extractSkills(node: SkillNode) {
            if (node.type === 'skill' || node.type === 'requirement') {
                skills.push(node.name);
            }
            if (node.children) {
                node.children.forEach(extractSkills);
            }
        }
        extractSkills(tree);
        
        const jobTitle = (tree as any).job_title || 'Software Engineer';
        const skillsList = skills.slice(0, 10).join(', ');
        
        const response = await fetch('http://localhost:5000/api/v1/generate-interview-questions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                job_title: jobTitle,
                skills: skillsList,
                skill_tree: JSON.stringify(tree)
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.questions && Array.isArray(data.questions)) {
                state.recommendedQuestions = data.questions.map((q: string, idx: number) => ({
                    id: idx + 1,
                    text: q,
                    asked: false,
                    skipped: false
                }));
            }
        } else {
            state.recommendedQuestions = skills.slice(0, 5).map((skill, idx) => ({
                id: idx + 1,
                text: `Can you explain your experience with ${skill}?`,
                asked: false,
                skipped: false
            }));
        }
    } catch (error) {
        console.error('Failed to generate questions:', error);
        state.recommendedQuestions = [
            {
                id: 1,
                text: 'Can you walk me through your relevant experience?',
                asked: false,
                skipped: false
            },
            {
                id: 2,
                text: 'What technical challenges have you faced in your previous projects?',
                asked: false,
                skipped: false
            },
            {
                id: 3,
                text: 'How do you approach problem-solving in a technical context?',
                asked: false,
                skipped: false
            }
        ];
    } finally {
        state.isLoadingQuestions = false;
        elements.questionsLoading.style.display = 'none';
        renderQuestions();
    }
}

// Render questions
function renderQuestions(): void {
    const questions = state.recommendedQuestions.filter(q => !q.asked && !q.skipped);
    elements.questionsList.innerHTML = '';
    
    questions.forEach(question => {
        const card = document.createElement('div');
        card.className = 'question-card';
        
        const timeDisplay = state.isRecording 
            ? `<div class="recording-timer">
                <i class="fas fa-pause"></i>
                ${formatTime(state.recordingTime)}
               </div>`
            : '';
        
        card.innerHTML = `
            ${timeDisplay}
            <p class="question-text">${question.text}</p>
            <div class="question-actions">
                <button class="btn-icon-small ask" data-question-id="${question.id}" data-action="ask">
                    <i class="fas fa-check-circle"></i>
                </button>
                <button class="btn-icon-small skip" data-question-id="${question.id}" data-action="skip">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        const askBtn = card.querySelector('[data-action="ask"]')!;
        const skipBtn = card.querySelector('[data-action="skip"]')!;
        askBtn.addEventListener('click', () => handleQuestionAction(question.id, 'ask'));
        skipBtn.addEventListener('click', () => handleQuestionAction(question.id, 'skip'));
        
        elements.questionsList.appendChild(card);
    });
}

function updateQuestionsOnRecordingChange(): void {
    if (state.recommendedQuestions.length > 0) {
        renderQuestions();
    }
}

// Handle question action
function handleQuestionAction(questionId: number, action: 'ask' | 'skip'): void {
    const question = state.recommendedQuestions.find(q => q.id === questionId);
    if (question) {
        if (action === 'ask') {
            question.asked = true;
            state.questionHistory.push({
                id: Date.now(),
                text: question.text,
                timestamp: new Date().toLocaleTimeString()
            });
        } else {
            question.skipped = true;
        }
        renderQuestions();
        renderQuestionHistory();
    }
}

// Render question history
function renderQuestionHistory(): void {
    if (state.questionHistory.length === 0) {
        elements.questionHistory.innerHTML = '<p class="empty-text">No questions asked yet.</p>';
    } else {
        elements.questionHistory.innerHTML = state.questionHistory.map(q => `
            <div class="history-entry">
                <p class="history-time">${q.timestamp}</p>
                <p class="history-text">${q.text}</p>
            </div>
        `).join('');
    }
}

// Render transcript
function renderTranscript(): void {
    elements.transcriptContainer.innerHTML = state.transcript.map(entry => `
        <div class="transcript-entry">
            <p class="transcript-time">${entry.timestamp}</p>
            <p class="transcript-text">${entry.text}</p>
        </div>
    `).join('');
}

// Render skill tree using D3
function renderSkillTree(tree: SkillNode): void {
    if (!tree) return;
    
    // Clear container
    elements.skillTreeContainer.innerHTML = '';
    
    // Initialize D3 visualization
    if (typeof (window as any).SkillTreeVisualization !== 'undefined') {
        skillTreeViz = new (window as any).SkillTreeVisualization(
            elements.skillTreeContainer,
            { skillTree: tree, skillProgress: state.skillProgress }
        );
        skillTreeViz.update(tree);
        
        // Handle window resize
        let resizeTimeout: ReturnType<typeof setTimeout>;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (skillTreeViz) {
                    skillTreeViz.resize();
                }
            }, 250);
        });
    } else {
        // Fallback if D3 not loaded
        elements.skillTreeContainer.innerHTML = '<div class="loading-text">Loading visualization...</div>';
    }
}

function updateSkillProgress(skillName: string, progress: number): void {
    const newProgress = Math.min(100, Math.max(0, progress));
    state.skillProgress.set(skillName, newProgress);
    
    if (skillTreeViz) {
        skillTreeViz.updateProgress(skillName, newProgress);
    } else if (state.skillTree) {
        renderSkillTree(state.skillTree);
    }
}

function incrementSkillProgress(skillName: string, amount: number = 25): void {
    const current = state.skillProgress.get(skillName) || 0;
    updateSkillProgress(skillName, current + amount);
}

// Process transcript for skill mentions
function processTranscript(): void {
    if (state.transcript.length > state.lastProcessedIndex && state.isRecording) {
        const newEntries = state.transcript.slice(state.lastProcessedIndex);
        state.lastProcessedIndex = state.transcript.length;
        
        setTimeout(() => {
            if (!state.isRecording) return;
            
            const lastEntry = newEntries[newEntries.length - 1];
            if (!lastEntry) return;
            
            const text = lastEntry.text.toLowerCase();
            const updates: Array<[string, number]> = [];
            
            if (text.includes('react') || text.includes('component')) {
                updates.push(['React', 20]);
            }
            if (text.includes('typescript') || text.includes('interface')) {
                updates.push(['TypeScript', 20]);
            }
            if (text.includes('css') || text.includes('flexbox') || text.includes('styling')) {
                updates.push(['CSS3', 20]);
            }
            if (text.includes('javascript')) {
                updates.push(['JavaScript', 20]);
            }
            
            if (updates.length > 0) {
                updates.forEach(([skill, amount]) => {
                    incrementSkillProgress(skill, amount);
                });
            }
        }, 500);
    }
}

// Event listeners
elements.sidebarToggle?.addEventListener('click', () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    elements.sidebar.classList.toggle('collapsed', state.sidebarCollapsed);
});

elements.questionsToggle?.addEventListener('click', () => {
    state.questionsCollapsed = !state.questionsCollapsed;
    elements.questionsContainer.style.display = state.questionsCollapsed ? 'none' : 'block';
    elements.questionsIcon.className = state.questionsCollapsed 
        ? 'fas fa-chevron-down' 
        : 'fas fa-chevron-up';
});

elements.recordButton?.addEventListener('click', toggleRecording);
elements.muteButton?.addEventListener('click', toggleMute);

// Initialize
async function init(): Promise<void> {
    initWaveform();
    await initVideoStream();
    await loadSkillTree();
    renderQuestionHistory();
    renderTranscript();
    updateMuteButton();
    
    // Watch for transcript updates
    setInterval(() => {
        processTranscript();
    }, 1000);
}

// Start app
init();

