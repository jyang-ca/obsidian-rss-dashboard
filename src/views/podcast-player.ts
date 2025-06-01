import { FeedItem } from "../types";

export class PodcastPlayer {
    private container: HTMLElement;
    private audioElement: HTMLAudioElement | null = null;
    private currentItem: FeedItem | null = null;
    private progressInterval: number | null = null;
    private progressData: Map<string, { position: number, duration: number }> = new Map();
    
    
    private playerEl: HTMLElement | null = null;
    private playButton: HTMLElement | null = null;
    private currentTimeEl: HTMLElement | null = null;
    private durationEl: HTMLElement | null = null;
    private progressBarEl: HTMLElement | null = null;
    private progressFilledEl: HTMLElement | null = null;
    private speedButtonEl: HTMLElement | null = null;
    
    constructor(container: HTMLElement) {
        this.container = container;
        
        
        this.loadProgressData();
    }
    
    /**
     * Load a podcast episode
     */
    loadEpisode(item: FeedItem): void {
        if (!item.audioUrl) {
            console.error("No audio URL provided for podcast episode");
            return;
        }
        
        this.currentItem = item;
        this.render();
        
        
        if (this.audioElement) {
            
            this.audioElement.src = item.audioUrl;
            this.audioElement.load();
            
            
            const savedProgress = this.progressData.get(item.guid);
            if (savedProgress && savedProgress.position > 0) {
                
                this.audioElement.currentTime = savedProgress.position;
                
                
                this.updateProgressDisplay();
            }
        }
    }
    
    /**
     * Render the podcast player
     */
    private render(): void {
        if (!this.currentItem) return;
        
        this.container.empty();
        
        
        this.playerEl = this.container.createDiv({
            cls: "rss-podcast-player",
        });
        
        
        const infoSection = this.playerEl.createDiv({
            cls: "rss-podcast-info",
        });
        
        
        if (this.currentItem.coverImage) {
            const coverImage = infoSection.createDiv({
                cls: "rss-podcast-cover",
            });
            
            coverImage.createEl("img", {
                attr: {
                    src: this.currentItem.coverImage,
                    alt: this.currentItem.title,
                },
            });
        }
        
        
        const details = infoSection.createDiv({
            cls: "rss-podcast-details",
        });
        
        details.createEl("h3", {
            cls: "rss-podcast-title",
            text: this.currentItem.title,
        });
        
        details.createDiv({
            cls: "rss-podcast-feed",
            text: this.currentItem.feedTitle,
        });
        
        if (this.currentItem.author) {
            details.createDiv({
                cls: "rss-podcast-author",
                text: this.currentItem.author,
            });
        }
        
        if (this.currentItem.duration) {
            details.createDiv({
                cls: "rss-podcast-duration",
                text: this.currentItem.duration,
            });
        }
        
        
        const controlsSection = this.playerEl.createDiv({
            cls: "rss-podcast-controls",
        });
        
        
        const skipBackButton = controlsSection.createDiv({
            cls: "rss-podcast-skip-back",
        });
        
        skipBackButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 17l-5-5 5-5"></path>
                <path d="M18 17l-5-5 5-5"></path>
            </svg>
            <span>15s</span>
        `;
        
        skipBackButton.addEventListener("click", () => {
            if (this.audioElement) {
                this.audioElement.currentTime = Math.max(0, this.audioElement.currentTime - 15);
                this.updateProgressDisplay();
            }
        });
        
    
        this.playButton = controlsSection.createDiv({
            cls: "rss-podcast-play",
        });
        
        this.updatePlayButtonIcon(false);
        
        this.playButton.addEventListener("click", () => {
            this.togglePlayback();
        });
        
        
        const skipForwardButton = controlsSection.createDiv({
            cls: "rss-podcast-skip-forward",
        });
        
        skipForwardButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M13 17l5-5-5-5"></path>
                <path d="M6 17l5-5-5-5"></path>
            </svg>
            <span>30s</span>
        `;
        
        skipForwardButton.addEventListener("click", () => {
            if (this.audioElement) {
                this.audioElement.currentTime = Math.min(
                    this.audioElement.duration, 
                    this.audioElement.currentTime + 30
                );
                this.updateProgressDisplay();
            }
        });
        
        
        const progressSection = this.playerEl.createDiv({
            cls: "rss-podcast-progress-section",
        });
        
        
        const timeDisplay = progressSection.createDiv({
            cls: "rss-podcast-time-display",
        });
        
        this.currentTimeEl = timeDisplay.createDiv({
            cls: "rss-podcast-current-time",
            text: "0:00",
        });
        
        timeDisplay.createDiv({
            cls: "rss-podcast-time-separator",
            text: "/",
        });
        
        this.durationEl = timeDisplay.createDiv({
            cls: "rss-podcast-duration-time",
            text: "0:00",
        });
        
        
        this.progressBarEl = progressSection.createDiv({
            cls: "rss-podcast-progress-bar",
        });
        
        this.progressFilledEl = this.progressBarEl.createDiv({
            cls: "rss-podcast-progress-filled",
        });
        
        
        this.progressBarEl.addEventListener("click", (e) => {
            if (!this.audioElement) return;
            
            const rect = this.progressBarEl!.getBoundingClientRect();
            const clickPosition = (e.clientX - rect.left) / rect.width;
            const seekTime = this.audioElement.duration * clickPosition;
            
            this.audioElement.currentTime = seekTime;
            this.updateProgressDisplay();
        });
        
        
        const extraControls = this.playerEl.createDiv({
            cls: "rss-podcast-extra-controls",
        });
        
        
        this.speedButtonEl = extraControls.createDiv({
            cls: "rss-podcast-speed",
            text: "1.0x",
        });
        
        this.speedButtonEl.addEventListener("click", () => {
            this.cyclePlaybackSpeed();
        });
        
        
        this.audioElement = document.createElement("audio");
        this.audioElement.preload = "metadata";
        this.audioElement.style.display = "none";
        this.playerEl.appendChild(this.audioElement);
        
        
        this.audioElement.addEventListener("play", () => {
            this.updatePlayButtonIcon(true);
            
            
            this.startProgressTracking();
        });
        
        this.audioElement.addEventListener("pause", () => {
            this.updatePlayButtonIcon(false);
            
            
            this.stopProgressTracking();
            
            
            this.saveProgress();
        });
        
        this.audioElement.addEventListener("ended", () => {
            this.updatePlayButtonIcon(false);
            this.stopProgressTracking();
            
            
            if (this.currentItem) {
                this.progressData.delete(this.currentItem.guid);
                this.saveProgressData();
            }
        });
        
        this.audioElement.addEventListener("loadedmetadata", () => {
            
            this.updateProgressDisplay();
        });
        
        
        if (this.currentItem && this.currentItem.audioUrl) {
            this.audioElement.src = this.currentItem.audioUrl;
            this.audioElement.load();
            
            
            const savedProgress = this.progressData.get(this.currentItem.guid);
            if (savedProgress && savedProgress.position > 0) {
                this.audioElement.currentTime = savedProgress.position;
                this.updateProgressDisplay();
            }
        }
    }
    
    /**
     * Toggle playback (play/pause)
     */
    private togglePlayback(): void {
        if (!this.audioElement) return;
        
        if (this.audioElement.paused) {
            this.audioElement.play();
        } else {
            this.audioElement.pause();
        }
    }
    
    /**
     * Cycle through playback speeds: 1.0x -> 1.25x -> 1.5x -> 1.75x -> 2.0x -> 0.75x -> 1.0x
     */
    private cyclePlaybackSpeed(): void {
        if (!this.audioElement || !this.speedButtonEl) return;
        
        const speeds = [1.0, 1.25, 1.5, 1.75, 2.0, 0.75];
        const currentSpeed = this.audioElement.playbackRate;
        
        
        let nextIndex = speeds.findIndex(speed => speed === currentSpeed) + 1;
        if (nextIndex >= speeds.length) nextIndex = 0;
        
        this.audioElement.playbackRate = speeds[nextIndex];
        this.speedButtonEl.textContent = `${speeds[nextIndex].toFixed(2)}x`;
    }
    
    /**
     * Start tracking playback progress
     */
    private startProgressTracking(): void {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
        }
        
        this.progressInterval = window.setInterval(() => {
            this.updateProgressDisplay();
            
            
            if (this.audioElement && this.currentItem) {
                this.saveProgress();
            }
        }, 1000);
    }
    
    /**
     * Stop tracking playback progress
     */
    private stopProgressTracking(): void {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }
    
    /**
     * Update the progress display
     */
    private updateProgressDisplay(): void {
        if (!this.audioElement) return;
        
        
        const currentTime = this.formatTime(this.audioElement.currentTime);
        if (this.currentTimeEl) {
            this.currentTimeEl.textContent = currentTime;
        }
        
        
        if (this.audioElement.duration && !isNaN(this.audioElement.duration)) {
            const duration = this.formatTime(this.audioElement.duration);
            if (this.durationEl) {
                this.durationEl.textContent = duration;
            }
            
            
            const progress = this.audioElement.currentTime / this.audioElement.duration;
            if (this.progressFilledEl) {
                this.progressFilledEl.style.width = `${progress * 100}%`;
            }
        }
    }
    
    /**
     * Format time in seconds to mm:ss
     */
    private formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
   
    private updatePlayButtonIcon(isPlaying: boolean): void {
        if (!this.playButton) return;
        
        if (isPlaying) {
            this.playButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
            `;
        } else {
            this.playButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
            `;
        }
    }
    
 
    private saveProgress(): void {
        if (!this.audioElement || !this.currentItem) return;
        
        
        if (this.audioElement.currentTime < 3) return;
        
        
        if (this.audioElement.duration && 
            this.audioElement.currentTime > this.audioElement.duration - 3) {
            return;
        }
        
        this.progressData.set(this.currentItem.guid, {
            position: this.audioElement.currentTime,
            duration: this.audioElement.duration || 0
        });
        
        this.saveProgressData();
    }
    
    /**
     * Save progress data to localStorage
     */
    private saveProgressData(): void {
        try {
            
            const data: Record<string, { position: number, duration: number }> = {};
            this.progressData.forEach((value, key) => {
                data[key] = value;
            });
            
            localStorage.setItem('rss-podcast-progress', JSON.stringify(data));
        } catch (error) {
            console.error("Error saving podcast progress:", error);
        }
    }
    
    /**
     * Load progress data from localStorage
     */
    private loadProgressData(): void {
        try {
            const data = localStorage.getItem('rss-podcast-progress');
            if (data) {
                const parsed = JSON.parse(data);
                
                this.progressData.clear();
                Object.entries(parsed).forEach(([key, value]) => {
                    this.progressData.set(key, value as { position: number, duration: number });
                });
            }
        } catch (error) {
            console.error("Error loading podcast progress:", error);
        }
    }
    
    /**
     * Clean up when removing the player
     */
    destroy(): void {
        this.stopProgressTracking();
        
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.src = "";
            this.audioElement.remove();
            this.audioElement = null;
        }
        
        this.saveProgressData();
    }
}
