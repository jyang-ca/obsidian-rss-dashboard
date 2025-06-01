import { ItemView, WorkspaceLeaf, Notice, Menu, MenuItem, TFile } from "obsidian";
import { Feed, FeedItem, Tag, RssDashboardSettings } from "../types";
import { Sidebar } from "../components/sidebar";
import { ArticleList } from "../components/article-list";
import { ArticleSaver } from "../services/article-saver";
import { ReaderView, RSS_READER_VIEW_TYPE } from "./reader-view";
import { RssDashboardSettingsModal } from "../modals/settings-modal";
import { FeedManagerModal } from "../modals/feed-manager-modal";
import { setIcon } from "obsidian";

export const RSS_DASHBOARD_VIEW_TYPE = "rss-dashboard-view";

export class RssDashboardView extends ItemView {
    private settings: RssDashboardSettings;
    private saver: ArticleSaver;
    private currentFolder: string | null = null;
    private currentFeed: Feed | null = null;
    private currentTag: string | null = null;
    private selectedArticle: FeedItem | null = null;
    private tagsCollapsed: boolean = true;
    private collapsedFolders: string[] = [];
    private sidebar: Sidebar;
    private articleList: ArticleList;
    private sidebarContainer: HTMLElement | null = null;
    
    constructor(
        leaf: WorkspaceLeaf, 
        private plugin: any 
    ) {
        super(leaf);
        this.settings = this.plugin.settings;
        this.collapsedFolders = this.settings.collapsedFolders || [];
        this.saver = new ArticleSaver(this.app.vault, this.settings.articleSaving);
    }

    getViewType(): string {
        return RSS_DASHBOARD_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "RSS Dashboard";
    }

    getIcon(): string {
        return "rss";
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.addClass("rss-dashboard-container");
        let dashboardContainer = container.querySelector('.rss-dashboard-layout') as HTMLElement;
        if (!dashboardContainer) {
            dashboardContainer = container.createDiv({ cls: "rss-dashboard-layout" });
        }

        // Create a container for the toggle button that stays visible
        let toggleContainer = dashboardContainer.querySelector('.rss-dashboard-toggle-container') as HTMLElement;
        if (!toggleContainer) {
            toggleContainer = dashboardContainer.createDiv({ cls: "rss-dashboard-toggle-container" });
            const toggleButton = toggleContainer.createDiv({
                cls: "rss-dashboard-sidebar-toggle",
                attr: { title: "Collapse/Expand Sidebar" },
            });
            setIcon(toggleButton, this.settings.sidebarCollapsed ? "chevron-right" : "chevron-left");
            toggleButton.addEventListener("click", (e) => {
                e.stopPropagation();
                this.handleToggleSidebar();
            });
        }
        
        if (!this.sidebarContainer) {
            this.sidebarContainer = document.createElement("div");
            this.sidebarContainer.className = "rss-dashboard-sidebar-container";
            dashboardContainer.appendChild(this.sidebarContainer);
        } else if (this.sidebarContainer.parentElement !== dashboardContainer) {
            dashboardContainer.appendChild(this.sidebarContainer);
        }

        
        if (!this.sidebar) {
            this.sidebar = new Sidebar(
                this.sidebarContainer,
                this.settings,
                {
                    currentFolder: this.currentFolder,
                    currentFeed: this.currentFeed,
                    currentTag: this.currentTag,
                    tagsCollapsed: this.tagsCollapsed,
                    collapsedFolders: this.collapsedFolders
                },
                {
                    onFolderClick: this.handleFolderClick.bind(this),
                    onFeedClick: this.handleFeedClick.bind(this),
                    onTagClick: this.handleTagClick.bind(this),
                    onToggleTagsCollapse: this.handleToggleTagsCollapse.bind(this),
                    onToggleFolderCollapse: this.handleToggleFolderCollapse.bind(this),
                    onAddFolder: this.handleAddFolder.bind(this),
                    onAddSubfolder: this.handleAddSubfolder.bind(this),
                    onAddFeed: this.handleAddFeed.bind(this),
                    onEditFeed: this.handleEditFeed.bind(this),
                    onDeleteFeed: this.handleDeleteFeed.bind(this),
                    onDeleteFolder: this.handleDeleteFolder.bind(this),
                    onRefreshFeeds: this.handleRefreshFeeds.bind(this),
                    onImportOpml: this.handleImportOpml.bind(this),
                    onExportOpml: this.handleExportOpml.bind(this),
                    onToggleSidebar: this.handleToggleSidebar.bind(this),
                    onOpenSettings: () => {
                        new RssDashboardSettingsModal(this.app, this.plugin).open();
                    },
                    onManageFeeds: () => {
                        new FeedManagerModal(this.app, this.plugin).open();
                    }
                }
            );
        }
        
        this.render();
    }
    
    /**
     * Main render method
     */
    render(): void {
        // Add sidebar-collapsed class to container when sidebar is collapsed
        if (this.settings.sidebarCollapsed) {
            this.containerEl.addClass('sidebar-collapsed');
        } else {
            this.containerEl.removeClass('sidebar-collapsed');
        }

        if (this.sidebar) {
            this.sidebar["options"] = {
                currentFolder: this.currentFolder,
                currentFeed: this.currentFeed,
                currentTag: this.currentTag,
                tagsCollapsed: this.tagsCollapsed,
                collapsedFolders: this.collapsedFolders
            };
            this.sidebar["settings"] = this.settings;
            this.sidebar.render();
        }

        
        const container = this.containerEl.children[1];
        let dashboardContainer = container.querySelector('.rss-dashboard-layout') as HTMLElement;
        if (!dashboardContainer) {
            dashboardContainer = container.createDiv({ cls: "rss-dashboard-layout" });
        }
        let contentContainer = dashboardContainer.querySelector('.rss-dashboard-content') as HTMLElement;
        if (!contentContainer) {
            contentContainer = dashboardContainer.createDiv({ cls: "rss-dashboard-content" });
        } else {
            contentContainer.empty();
        }
        const articlesContainer = contentContainer.createDiv({ cls: "rss-dashboard-articles" });
        this.articleList = new ArticleList(
            articlesContainer,
            this.settings,
            this.getArticlesTitle(),
            this.getFilteredArticles(),
            this.selectedArticle,
            {
                onArticleClick: this.handleArticleClick.bind(this),
                onToggleViewStyle: this.handleToggleViewStyle.bind(this),
                onRefreshFeeds: this.handleRefreshFeeds.bind(this),
                onCardSizeChange: this.handleCardSizeChange.bind(this),
                onArticleUpdate: this.handleArticleUpdate.bind(this),
                onArticleSave: this.handleArticleSave.bind(this)
            }
        );
        this.articleList.render();
    }
    
    /**
     * Get articles title based on current selection
     */
    private getArticlesTitle(): string {
        if (this.currentFeed) {
            return this.currentFeed.title;
        } else if (this.currentFolder === "starred") {
            return "Starred Items";
        } else if (this.currentFolder === "unread") {
            return "Unread Items";
        } else if (this.currentFolder === "read") {
            return "Read Items";
        } else if (this.currentFolder === "saved") {
            return "Saved Items";
        } else if (this.currentFolder === "videos") {
            return "Videos";
        } else if (this.currentFolder === "podcasts") {
            return "Podcasts";
        } else if (this.currentTag) {
            return `Tag: ${this.currentTag}`;
        } else if (this.currentFolder) {
            return this.currentFolder;
        } else {
            return "All Articles";
        }
    }
    
    /**
     * Get filtered articles based on current selection
     */
    private getFilteredArticles(): FeedItem[] {
        let articles: FeedItem[] = [];
        
        if (this.currentFeed) {
            
            articles = this.currentFeed.items.slice(0, this.settings.maxItems);
        } else {
            
            if (this.currentFolder === "starred") {
                for (const feed of this.settings.feeds) {
                    articles = articles.concat(
                        feed.items
                            .filter((item) => item.starred)
                            .map((item) => ({
                                ...item,
                                feedTitle: feed.title,
                                feedUrl: feed.url
                            }))
                    );
                }
            }
            
            else if (this.currentFolder === "unread") {
                for (const feed of this.settings.feeds) {
                    articles = articles.concat(
                        feed.items
                            .filter((item) => !item.read)
                            .map((item) => ({
                                ...item,
                                feedTitle: feed.title,
                                feedUrl: feed.url,
                            }))
                    );
                }
            }
            
            else if (this.currentFolder === "read") {
                for (const feed of this.settings.feeds) {
                    articles = articles.concat(
                        feed.items
                            .filter((item) => item.read)
                            .map((item) => ({
                                ...item,
                                feedTitle: feed.title,
                                feedUrl: feed.url,
                            }))
                    );
                }
            }
            
            else if (this.currentFolder === "saved") {
                for (const feed of this.settings.feeds) {
                    articles = articles.concat(
                        feed.items
                            .filter((item) => item.saved)
                            .map((item) => ({
                                ...item,
                                feedTitle: feed.title,
                                feedUrl: feed.url,
                            }))
                    );
                }
            }
            
            else if (this.currentFolder === "videos") {
                for (const feed of this.settings.feeds) {
                    articles = articles.concat(
                        feed.items
                            .filter((item) => item.mediaType === 'video')
                            .map((item) => ({
                                ...item,
                                feedTitle: feed.title,
                                feedUrl: feed.url,
                            }))
                    );
                }
            }
            
            else if (this.currentFolder === "podcasts") {
                for (const feed of this.settings.feeds) {
                    articles = articles.concat(
                        feed.items
                            .filter((item) => item.mediaType === 'podcast')
                            .map((item) => ({
                                ...item,
                                feedTitle: feed.title,
                                feedUrl: feed.url,
                            }))
                    );
                }
            }
            
            else if (this.currentTag) {
                const tagName = this.currentTag.toLowerCase();
                
                for (const feed of this.settings.feeds) {
                    const taggedItems = feed.items.filter(item => {
                        
                        if (!item.tags) return false;
                        
                        
                        return item.tags.some(tag => 
                            tag.name.toLowerCase() === tagName
                        );
                    });
                    
                    articles = articles.concat(
                        taggedItems.map(item => ({
                            ...item,
                            feedTitle: feed.title,
                            feedUrl: feed.url,
                        }))
                    );
                }
            }
            
            else {
                const feedsToShow =
                    this.currentFolder &&
                    !["read", "unread", "starred", "saved", "videos", "podcasts"].includes(this.currentFolder)
                        ? this.settings.feeds.filter(
                              (feed) => {
                                  if (!feed.folder) return false;
                                  
                                  if (feed.folder === this.currentFolder) {
                                      return true;
                                  }
                                  
                                  if (feed.folder.startsWith(this.currentFolder + '/')) {
                                      return true;
                                  }
                                  
                                  return false;
                              }
                          )
                        : this.settings.feeds;

                feedsToShow.sort((a, b) => {
                    if (!a.folder) return 1;
                    if (!b.folder) return -1;
                    return a.folder.localeCompare(b.folder);
                });

                for (const feed of feedsToShow) {
                    articles = articles.concat(
                        feed.items.map((item) => ({
                            ...item,
                            feedTitle: feed.title,
                            feedUrl: feed.url,
                        }))
                    );
                }
            }

            
            articles.sort(
                (a, b) =>
                    new Date(b.pubDate).getTime() -
                    new Date(a.pubDate).getTime()
            );
            articles = articles.slice(0, this.settings.maxItems);
        }
        
        return articles;
    }
    
    /**
     * Handle clicking on a folder
     */
    private handleFolderClick(folder: string | null): void {
        let scrollPosition = 0;
        if (this.sidebarContainer) {
            const foldersSection = this.sidebarContainer.querySelector('.rss-dashboard-feed-folders-section');
            if (foldersSection) scrollPosition = (foldersSection as HTMLElement).scrollTop;
        }

        // Clear current selections
        this.currentFeed = null;
        this.currentTag = null;
        this.selectedArticle = null;
        
        // Update current folder
        this.currentFolder = folder;
        
        // Force a complete re-render
        this.render();
        
        // Restore scroll position
        if (this.sidebarContainer) {
            setTimeout(() => {
                const foldersSection = this.sidebarContainer!.querySelector('.rss-dashboard-feed-folders-section');
                if (foldersSection) (foldersSection as HTMLElement).scrollTop = scrollPosition;
            }, 0);
        }
    }
    
    /**
     * Handle clicking on a feed
     */
    private handleFeedClick(feed: Feed): void {
        let scrollPosition = 0;
        if (this.sidebarContainer) {
            const foldersSection = this.sidebarContainer.querySelector('.rss-dashboard-feed-folders-section');
            if (foldersSection) scrollPosition = (foldersSection as HTMLElement).scrollTop;
        }
        this.currentFeed = feed;
        this.currentFolder = null;
        this.currentTag = null;
        this.selectedArticle = null;
        this.render();
        if (this.sidebarContainer) {
            setTimeout(() => {
                const foldersSection = this.sidebarContainer!.querySelector('.rss-dashboard-feed-folders-section');
                if (foldersSection) (foldersSection as HTMLElement).scrollTop = scrollPosition;
            }, 0);
        }
    }
    
    /**
     * Handle clicking on a tag
     */
    private handleTagClick(tag: string | null): void {
        this.currentTag = tag;
        this.currentFolder = null;
        this.currentFeed = null;
        this.selectedArticle = null;
        this.render();
    }
    
    /**
     * Handle toggling tags collapse
     */
    private handleToggleTagsCollapse(): void {
        this.tagsCollapsed = !this.tagsCollapsed;
        this.render();
    }
    
    /**
     * Handle toggling folder collapse
     */
    private handleToggleFolderCollapse(folder: string): void {
        if (this.collapsedFolders.includes(folder)) {
            this.collapsedFolders = this.collapsedFolders.filter(
                (f) => f !== folder
            );
        } else {
            this.collapsedFolders.push(folder);
        }
        this.settings.collapsedFolders = this.collapsedFolders;
        this.plugin.saveSettings();
        this.render();
    }
    
    /**
     * Handle adding a folder
     */
    private handleAddFolder(name: string): void {
        this.plugin.addFolder(name);
    }
    
    /**
     * Handle adding a subfolder
     */
    private handleAddSubfolder(parent: string, name: string): void {
        this.plugin.addSubfolder(parent, name);
    }
    
    /**
     * Handle adding a feed
     */
    private handleAddFeed(title: string, url: string, folder: string): void {
        this.plugin.addFeed(title, url, folder);
    }
    
   
    private handleEditFeed(feed: Feed, title: string, url: string, folder: string): void {
        this.plugin.editFeed(feed, title, url, folder);
    }
    
 
    private handleDeleteFeed(feed: Feed): void {
        this.plugin.settings.feeds = this.plugin.settings.feeds.filter((f: Feed) => f !== feed);
        this.plugin.saveSettings();
        
        
        if (this.currentFeed === feed) {
            this.currentFeed = null;
        }
        
        this.render();
    }
    
    
    private handleDeleteFolder(folder: string): void {
        
        this.plugin.settings.feeds = this.plugin.settings.feeds.filter(
            (feed: Feed) => feed.folder !== folder
        );
        
        
        this.plugin.settings.folders = this.plugin.settings.folders.filter(
            (f: { name: string }) => f.name !== folder
        );
        
        this.plugin.saveSettings();
        
        
        if (this.currentFolder === folder) {
            this.currentFolder = null;
        }
        
        this.render();
    }
    
    /**
     * Handle refreshing feeds
     */
    private handleRefreshFeeds(): void {
        this.plugin.refreshFeeds();
    }
    
    /**
     * Handle importing OPML
     */
    private handleImportOpml(): void {
        this.plugin.importOpml();
    }
    
    /**
     * Handle exporting OPML
     */
    private handleExportOpml(): void {
        this.plugin.exportOpml();
    }
    
    /**
     * Handle toggling sidebar
     */
    private handleToggleSidebar(): void {
        this.settings.sidebarCollapsed = !this.settings.sidebarCollapsed;
        this.plugin.saveSettings();
        this.render();
    }
    

    private async handleArticleClick(article: FeedItem): Promise<void> {
        this.selectedArticle = article;
        
        
        if (!article.read) {
            await this.updateArticleStatus(article, { read: true }, false);
        }
        
        
        if (this.settings.media.openInSplitView) {
            
            await this.openArticleInSplitView(article);
        } else {
            
            window.open(article.link, "_blank");
        }
    }
    
    /**
     * Open an article in a split view
     */
    private async openArticleInSplitView(article: FeedItem): Promise<void> {
        const { workspace } = this.app;
        
        let leaf: WorkspaceLeaf | null = null;
        let isNewLeaf = false;
        
        
        const readerLeaves = workspace.getLeavesOfType(RSS_READER_VIEW_TYPE);
        
        if (readerLeaves.length > 0) {
            leaf = readerLeaves[0];
        } else {
            
            isNewLeaf = true;
            
            switch (this.settings.readerViewLocation) {
                case "main":
                    leaf = workspace.getLeaf("split");
                    break;
                case "left-sidebar":
                    leaf = workspace.getLeftLeaf(false);
                    break;
                case "right-sidebar":
                default:
                    leaf = workspace.getRightLeaf(false);
                    break;
            }
            
            if (leaf) {
                await leaf.setViewState({
                    type: RSS_READER_VIEW_TYPE,
                    active: true,
                });
            }
        }
        
        
        if (leaf) {
            const view = leaf.view as ReaderView;
            
            if (view) {
                
                const relatedItems = this.getRelatedItems(article);
                
                await view.displayItem(article, relatedItems);
                workspace.revealLeaf(leaf);
            }
        }
    }
    
    /**
     * Get related items for an article
     */
    private getRelatedItems(article: FeedItem): FeedItem[] {
        if (!article.feedUrl) return [];
        
        
        const feed = this.settings.feeds.find((f: any) => f.url === article.feedUrl);
        if (!feed) return [];
        
        
        return feed.items
            .filter(item => item.guid !== article.guid)
            .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
            .slice(0, 5);
    }
    
    /**
     * Handle toggling view style
     */
    private handleToggleViewStyle(style: "list" | "card"): void {
        this.settings.viewStyle = style;
        this.plugin.saveSettings();
        this.render();
    }
    
    /**
     * Handle card size change
     */
    private handleCardSizeChange(property: "width" | "height", value: number): void {
        if (property === "width") {
            this.settings.cardWidth = value;
        } else {
            this.settings.cardHeight = value;
        }
        
        this.plugin.saveSettings();
        
        if (this.settings.viewStyle === "card") {
            this.render();
        }
    }
    
    /**
     * Handle article status update (read/starred/tags)
     */
    private async handleArticleUpdate(article: FeedItem, updates: Partial<FeedItem>, shouldRerender = true): Promise<void> {
        await this.updateArticleStatus(article, updates, shouldRerender);
    }
    
    /**
     * Handle saving an article
     */
    private async handleArticleSave(article: FeedItem): Promise<void> {
        const file = await this.saver.saveArticle(article);
        
        if (file) {
            
            await this.updateArticleStatus(article, { saved: true });
            
            
            this.app.workspace.getLeaf().openFile(file);
        }
    }
    
    /**
     * Update article status in its feed
     */
    private async updateArticleStatus(article: FeedItem, updates: Partial<FeedItem>, shouldRerender = true): Promise<void> {
        
        const feed = this.settings.feeds.find((f: any) => f.url === article.feedUrl);
        
        if (!feed) return;

        
        const originalArticle = (feed as any).items.find(
            (item: any) => item.guid === article.guid
        );
        
        if (!originalArticle) return;

        
        Object.assign(originalArticle, updates);
        Object.assign(article, updates);

        
        if (updates.tags) {
            originalArticle.tags = updates.tags;
            article.tags = updates.tags;
        }

        
        await this.plugin.saveSettings();

        
        if (shouldRerender) {
            this.render();
        }
    }
    
    /**
     * Show the edit feed modal
     */
    showEditFeedModal(feed: Feed): void {
        this.sidebar.showEditFeedModal(feed);
    }
    
    /**
     * Refresh the view
     */
    refresh(): void {
        this.render();
    }

    async onClose(): Promise<void> {
        
    }
}
