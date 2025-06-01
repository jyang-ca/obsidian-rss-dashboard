import { TFile } from "obsidian";


export interface FeedItem {
    title: string;
    link: string;
    description: string;
    pubDate: string;
    guid: string;
    read: boolean;
    starred: boolean;
    tags: Tag[];
    feedTitle: string;
    feedUrl: string; 
    coverImage: string;
    
    mediaType?: 'article' | 'video' | 'podcast';
    videoId?: string;
    audioUrl?: string;
    duration?: string;
    author?: string;
    summary?: string;
    content?: string;
    saved?: boolean;
    
    explicit?: boolean;
    image?: string;
    category?: string;
    episodeType?: string;
    season?: number;
    episode?: number;
    enclosure?: {
        url: string;
        type: string;
        length: string;
    };
}

export interface Feed {
    title: string;
    url: string;
    folder: string;
    items: FeedItem[];
    lastUpdated: number;
    
    mediaType?: 'article' | 'video' | 'podcast';
    autoDetect?: boolean;
    customTemplate?: string;
    customFolder?: string;
    customTags?: string[];
}

export interface Tag {
    name: string;
    color: string;
}

export interface Folder {
    name: string;
    subfolders: Folder[];
}

export type ViewLocation = "main" | "right-sidebar" | "left-sidebar";


export interface MediaSettings {
    defaultYouTubeFolder: string;
    defaultYouTubeTag: string;
    defaultPodcastFolder: string;
    defaultPodcastTag: string;
    autoDetectMediaType: boolean;
    openInSplitView: boolean;
}

export interface ArticleSavingSettings {
    defaultTemplate: string;
    defaultFolder: string;
    addSavedTag: boolean;
    includeFrontmatter: boolean;
    frontmatterTemplate: string;
}

export interface DisplaySettings {
    showCoverImage: boolean;
    showSummary: boolean;
}


export interface RssDashboardSettings {
    feeds: Feed[];
    viewStyle: "list" | "card";
    refreshInterval: number;
    maxItems: number;
    cardWidth: number;
    cardHeight: number;
    sidebarCollapsed: boolean;
    availableTags: Tag[];
    collapsedFolders: string[];
    folders: Folder[];
    viewLocation: ViewLocation;
    readerViewLocation: ViewLocation;
    useWebViewer: boolean;
    
    media: MediaSettings;
    articleSaving: ArticleSavingSettings;
    display: DisplaySettings;
}


export const DEFAULT_SETTINGS: RssDashboardSettings = {
    feeds: [
        
    ],
    viewStyle: "list",
    refreshInterval: 30, 
    maxItems: 100,
    cardWidth: 300,
    cardHeight: 360,
    sidebarCollapsed: false,
    availableTags: [
        { name: "Important", color: "#e74c3c" },
        { name: "Read Later", color: "#3498db" },
        { name: "Favorite", color: "#f1c40f" },
        { name: "YouTube", color: "#ff0000" },
        { name: "Podcast", color: "#8e44ad" },
        { name: "Saved", color: "#16a085" }
    ],
    collapsedFolders: [],
    folders: [
        { name: "Videos", subfolders: [] },
        { name: "Podcasts", subfolders: [] }
    ],
    viewLocation: "main",
    readerViewLocation: "main",
    useWebViewer: true,
    media: {
        defaultYouTubeFolder: "Videos",
        defaultYouTubeTag: "youtube",
        defaultPodcastFolder: "Podcasts",
        defaultPodcastTag: "podcast",
        autoDetectMediaType: true,
        openInSplitView: true
    },
    articleSaving: {
        defaultTemplate: "# {{title}}\n\n{{content}}\n\n[Source]({{link}})",
        defaultFolder: "RSS Articles",
        addSavedTag: true,
        includeFrontmatter: true,
        frontmatterTemplate: "---\ntitle: \"{{title}}\"\ndate: {{date}}\ntags: [{{tags}}]\nsource: \"{{source}}\"\nlink: {{link}}\n---\n\n"
    },
    display: {
        showCoverImage: true,
        showSummary: true
    }
};
