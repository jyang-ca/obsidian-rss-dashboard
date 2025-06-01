import {
    App,
    Plugin,
    Notice,
    TFile,
    requestUrl,
    WorkspaceLeaf
} from "obsidian";

import { 
    RssDashboardSettings,
    DEFAULT_SETTINGS,
    Feed,
    FeedItem,
    Folder,
    Tag
} from "./src/types";

import { RssDashboardSettingTab } from "./src/settings/settings-tab";
import { RssDashboardView, RSS_DASHBOARD_VIEW_TYPE } from "./src/views/dashboard-view";
import { ReaderView, RSS_READER_VIEW_TYPE } from "./src/views/reader-view";
import { FeedParser } from "./src/services/feed-parser";
import { ArticleSaver } from "./src/services/article-saver";
import { OpmlManager } from "./src/services/opml-manager";
import { MediaService } from "./src/services/media-service";

export default class RssDashboardPlugin extends Plugin {
    settings: RssDashboardSettings;
    view: RssDashboardView;
    readerView: ReaderView;
    feedParser: FeedParser;
    articleSaver: ArticleSaver;

    async onload() {
        console.log("Loading RSS Dashboard plugin");
        
        
        await this.loadSettings();
        
        try {
            
            this.feedParser = new FeedParser(this.settings.media, this.settings.availableTags);
            this.articleSaver = new ArticleSaver(this.app.vault, this.settings.articleSaving);
            
            
            this.registerView(
                RSS_DASHBOARD_VIEW_TYPE,
                (leaf) => {
                    
                    this.view = new RssDashboardView(leaf, this);
                    return this.view;
                }
            );
            
            this.registerView(
                RSS_READER_VIEW_TYPE,
                (leaf) => {
                    
                    this.readerView = new ReaderView(
                        leaf, 
                        this.settings, 
                        this.articleSaver,
                        this.onArticleSaved.bind(this)
                    );
                    return this.readerView;
                }
            );
    
            
            this.addRibbonIcon("rss", "RSS Dashboard", () => {
                this.activateView();
            });
    
            
            this.addSettingTab(new RssDashboardSettingTab(this.app, this));
    
            
            this.addCommand({
                id: "open-rss-dashboard",
                name: "Open RSS Dashboard",
                callback: () => {
                    this.activateView();
                },
            });
    
            this.addCommand({
                id: "refresh-rss-feeds",
                name: "Refresh RSS Feeds",
                callback: () => {
                    this.refreshFeeds();
                },
            });
    
            this.addCommand({
                id: "import-opml",
                name: "Import OPML",
                callback: () => {
                    this.importOpml();
                },
            });
    
            this.addCommand({
                id: "export-opml",
                name: "Export OPML",
                callback: () => {
                    this.exportOpml();
                },
            });
    
            this.addCommand({
                id: "toggle-rss-sidebar",
                name: "Toggle RSS Dashboard Sidebar",
                callback: () => {
                    if (this.view) {
                        this.settings.sidebarCollapsed = !this.settings.sidebarCollapsed;
                        this.saveSettings();
                        this.view.render();
                    }
                },
            });
    
            
            this.registerInterval(
                window.setInterval(
                    () => this.refreshFeeds(),
                    this.settings.refreshInterval * 60 * 1000
                )
            );
            
            console.log("RSS Dashboard plugin loaded successfully");
        } catch (error) {
            console.error("Error initializing RSS Dashboard plugin:", error);
            new Notice("Error initializing RSS Dashboard plugin. Check console for details.");
        }
    }

    async activateView() {
        const { workspace } = this.app;

        try {
            let leaf: WorkspaceLeaf | null = null;
            const leaves = workspace.getLeavesOfType(RSS_DASHBOARD_VIEW_TYPE);
    
            if (leaves.length > 0) {
                
                leaf = leaves[0];
            } else {
                
                switch (this.settings.viewLocation) {
                    case "left-sidebar":
                        leaf = workspace.getLeftLeaf(false);
                        break;
                    case "right-sidebar":
                        leaf = workspace.getRightLeaf(false);
                        break;
                    case "main":
                    default:
                        leaf = workspace.getLeaf("tab");
                        break;
                }
    
                if (leaf) {
                    await leaf.setViewState({
                        type: RSS_DASHBOARD_VIEW_TYPE,
                        active: true,
                    });
                }
            }
    
            if (leaf) {
                workspace.revealLeaf(leaf);
            }
        } catch (error) {
            console.error("Error activating RSS Dashboard view:", error);
            new Notice("Error opening RSS Dashboard. Check console for details.");
        }
    }

    
    private onArticleSaved(item: FeedItem): void {
        
        if (item.feedUrl) {
            const feed = this.settings.feeds.find(f => f.url === item.feedUrl);
            if (feed) {
                const originalItem = feed.items.find(i => i.guid === item.guid);
                if (originalItem) {
                    originalItem.saved = true;
                    
                    
                    if (this.settings.articleSaving.addSavedTag) {
                        if (!originalItem.tags) {
                            originalItem.tags = [];
                        }
                        
                        
                        if (!originalItem.tags.some(t => t.name.toLowerCase() === "saved")) {
                            const savedTag = this.settings.availableTags.find(t => t.name.toLowerCase() === "saved");
                            if (savedTag) {
                                originalItem.tags.push({ ...savedTag });
                            } else {
                                originalItem.tags.push({ name: "saved", color: "#3498db" });
                            }
                        }
                    }
                    
                    this.saveSettings();
                    
                    
                    if (this.view) {
                        this.view.render();
                    }
                }
            }
        }
    }

    async refreshFeeds() {
        try {
            new Notice("Refreshing feeds...");
            
            const updatedFeeds = await this.feedParser.refreshAllFeeds(this.settings.feeds);
            this.settings.feeds = updatedFeeds;
            
            
            await this.saveSettings();

            
            if (this.view) {
                this.view.refresh();
                new Notice("All feeds refreshed");
            }
        } catch (error) {
            console.error("Error refreshing feeds:", error);
            new Notice(`Error refreshing feeds: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    
    async updateArticle(
        articleGuid: string,
        feedUrl: string,
        updates: Partial<FeedItem>
    ) {
        
        const feed = this.settings.feeds.find((f) => f.url === feedUrl);
        if (!feed) return;

        
        const article = feed.items.find((item) => item.guid === articleGuid);
        if (!article) return;

        
        Object.assign(article, updates);

        
        await this.saveSettings();

        
        if (this.view) {
            this.view.refresh();
        }
    }

    async importOpml() {
        
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".opml";

        input.onchange = async (e: Event) => {
            const target = e.target as HTMLInputElement;
            const file = target.files?.[0];

            if (file) {
                const reader = new FileReader();

                reader.onload = async (e) => {
                    const contents = e.target?.result as string;

                    try {
                        
                        const result = await OpmlManager.importOpml(
                            contents, 
                            this.settings.feeds,
                            this.settings.folders
                        );
                        
                        
                        this.settings.feeds = result.feeds;
                        this.settings.folders = result.folders;
                        
                        await this.saveSettings();
                        await this.refreshFeeds();

                        
                        new Notice(`OPML import successful`);
                    } catch (error) {
                        console.error("Error parsing OPML:", error);
                        new Notice("Failed to import OPML: Invalid format");
                    }
                };

                reader.readAsText(file);
            }
        };

        input.click();
    }

    async exportOpml() {
        
        const opmlContent = OpmlManager.generateOpml(
            this.settings.feeds,
            this.settings.folders
        );

        
        const blob = new Blob([opmlContent], { type: "text/xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "obsidian-rss-feeds.opml";
        a.click();
        URL.revokeObjectURL(url);
    }

    
    async addFolder(folderName: string) {
        
        const folderExists = this.settings.folders.some(f => f.name === folderName);
        
        if (!folderExists) {
            
            this.settings.folders.push({ name: folderName, subfolders: [] });
            await this.saveSettings();
            
            if (this.view) {
                this.view.refresh();
                new Notice(`Folder "${folderName}" created`);
            }
        } else {
            new Notice(`Folder "${folderName}" already exists`);
        }
    }

    
    async addFeed(title: string, url: string, folder: string) {
        try {
            
            if (this.settings.feeds.some((f) => f.url === url)) {
                new Notice("This feed URL already exists");
                return;
            }
    
            
            const newFeed: Feed = {
                title,
                url,
                folder,
                items: [],
                lastUpdated: 0
            };
    
            
            this.settings.feeds.push(newFeed);
            await this.saveSettings();
            
            
            try {
                const parsedFeed = await this.feedParser.parseFeed(url, newFeed);
                
                
                const index = this.settings.feeds.findIndex(f => f.url === url);
                if (index >= 0) {
                    this.settings.feeds[index] = parsedFeed;
                }
                
                await this.saveSettings();
            } catch (error) {
                console.error("Error parsing new feed:", error);
                new Notice(`Error parsing feed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
    
            if (this.view) {
                this.view.refresh();
                new Notice(`Feed "${title}" added`);
            }
        } catch (error) {
            console.error("Error adding feed:", error);
            new Notice(`Error adding feed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    
    async addYouTubeFeed(input: string, customTitle?: string) {
        try {
            
            const feedUrl = await MediaService.getYouTubeRssFeed(input);
            
            if (!feedUrl) {
                new Notice("Unable to determine YouTube feed URL from input");
                return;
            }
            
            
            if (this.settings.feeds.some(f => f.url === feedUrl)) {
                new Notice("This YouTube feed already exists");
                return;
            }
            
            
            const title = customTitle || `YouTube: ${input}`;
            await this.addFeed(title, feedUrl, this.settings.media.defaultYouTubeFolder);
            
        } catch (error) {
            console.error("Error adding YouTube feed:", error);
            new Notice(`Error adding YouTube feed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    
    async addSubfolder(parentFolderName: string, subfolderName: string) {
        
        const parentFolder = this.settings.folders.find(
            (f) => f.name === parentFolderName
        );
        
        if (parentFolder) {
            
            if (!parentFolder.subfolders.some((sf) => sf.name === subfolderName)) {
                parentFolder.subfolders.push({
                    name: subfolderName,
                    subfolders: [],
                });
                
                await this.saveSettings();
                
                if (this.view) {
                    this.view.refresh();
                    new Notice(`Subfolder "${subfolderName}" created under "${parentFolderName}"`);
                }
            } else {
                new Notice(`Subfolder "${subfolderName}" already exists in "${parentFolderName}"`);
            }
        }
    }

    
    async editFeed(feed: Feed, newTitle: string, newUrl: string, newFolder: string) {
        feed.title = newTitle;
        feed.url = newUrl;
        feed.folder = newFolder;
        
        await this.saveSettings();
        
        if (this.view) {
            this.view.refresh();
            new Notice(`Feed "${newTitle}" updated`);
        }
    }

    async loadSettings() {
        try {
            let data = await this.loadData();
            
            
            this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
            
            
            if (!this.settings.readerViewLocation) {
                this.settings.readerViewLocation = "right-sidebar";
            }
            
            
            if (this.settings.useWebViewer === undefined) {
                this.settings.useWebViewer = true;
            }
        } catch (error) {
            console.error("Error loading settings:", error);
            new Notice(`Error loading settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
            this.settings = DEFAULT_SETTINGS;
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    onunload() {
        console.log("Unloading RSS Dashboard plugin");
        this.app.workspace.detachLeavesOfType(RSS_DASHBOARD_VIEW_TYPE);
        this.app.workspace.detachLeavesOfType(RSS_READER_VIEW_TYPE);
    }
}
