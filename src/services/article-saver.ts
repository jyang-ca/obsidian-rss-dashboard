import { TFile, Vault, Notice } from "obsidian";
import { FeedItem, ArticleSavingSettings } from "../types";
import TurndownService from "turndown";

// @ts-ignore
export class ArticleSaver {
    private vault: Vault;
    private settings: ArticleSavingSettings;
    private turndownService: TurndownService;
    
    constructor(vault: Vault, settings: ArticleSavingSettings) {
        this.vault = vault;
        this.settings = settings;
        this.turndownService = new TurndownService();

        // @ts-ignore
        this.turndownService.addRule('math', {
            filter: function (node: any) {
                return node.nodeName === 'SPAN' && node.classList.contains('math');
            },
            replacement: function (content: string, node: any) {
                return node.textContent || '';
            }
        });
    }
    
   
    private cleanHtml(html: string): string {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            
            
            const elementsToRemove = doc.querySelectorAll(
                "script, style, iframe, .ad, .ads, .advertisement, " +
                "div[class*='ad-'], div[id*='ad-'], div[class*='ads-'], div[id*='ads-']"
            );
            elementsToRemove.forEach(el => el.remove());
            
            
            const svgElements = doc.querySelectorAll("svg");
            svgElements.forEach(el => el.remove());
            
            
            const imgElements = doc.querySelectorAll("img");
            imgElements.forEach(img => {
                const src = img.getAttribute("src");
                if (src && !src.startsWith("http") && !src.startsWith("data:")) {
                    
                    if (src.startsWith("/")) {
                        
                        const baseUrl = new URL(location.href);
                        img.setAttribute("src", `${baseUrl.origin}${src}`);
                    }
                }
                
                
                if (!img.hasAttribute("alt")) {
                    img.setAttribute("alt", "Image");
                }
            });
            
            
            const linkElements = doc.querySelectorAll("a");
            linkElements.forEach(link => {
                link.setAttribute("target", "_blank");
                link.setAttribute("rel", "noopener noreferrer");
            });
            
            
            const tableElements = doc.querySelectorAll("table");
            tableElements.forEach(table => {
                table.classList.add("markdown-compatible-table");
            });
            
            return doc.body.innerHTML;
        } catch (e) {
            console.error("Error cleaning HTML:", e);
            return html;
        }
    }
    
    /**
     * Generate frontmatter for the article
     */
    private generateFrontmatter(item: FeedItem): string {
        
        let frontmatter = this.settings.frontmatterTemplate;
        
        
        if (!frontmatter) {
            frontmatter = "---\ntitle: \"{{title}}\"\ndate: {{date}}\ntags: [{{tags}}]\nsource: \"{{source}}\"\nlink: {{link}}\n---\n\n";
        }
        
        
        let tagsString = "";
        if (item.tags && item.tags.length > 0) {
            tagsString = item.tags.map(tag => tag.name).join(", ");
        }
        
        
        if (this.settings.addSavedTag && !tagsString.toLowerCase().includes("saved")) {
            tagsString = tagsString ? `${tagsString}, saved` : "saved";
        }
        
        
        frontmatter = frontmatter
            .replace(/{{title}}/g, item.title.replace(/"/g, '\\"'))
            .replace(/{{date}}/g, new Date(item.pubDate).toISOString())
            .replace(/{{tags}}/g, tagsString)
            .replace(/{{source}}/g, item.feedTitle.replace(/"/g, '\\"'))
            .replace(/{{link}}/g, item.link)
            .replace(/{{author}}/g, (item.author || '').replace(/"/g, '\\"'));
            
        
        if (item.mediaType === 'video' && item.videoId) {
            frontmatter = frontmatter.replace("---\n", `---\nmediaType: video\nvideoId: "${item.videoId}"\n`);
        } else if (item.mediaType === 'podcast' && item.audioUrl) {
            frontmatter = frontmatter.replace("---\n", `---\nmediaType: podcast\naudioUrl: "${item.audioUrl}"\n`);
        }
        
        return frontmatter;
    }
    
    /**
     * Create a sanitized filename
     */
    private sanitizeFilename(name: string): string {
        // Remove special characters and clean up spaces
        let sanitized = name
            .replace(/[\/\\:*?"<>|]/g, '') // Remove invalid characters
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .trim(); // Remove leading/trailing spaces

        // Take first 5 words and limit total length to 50 characters
        const words = sanitized.split(' ');
        const shortened = words.slice(0, 5).join(' ');
        return shortened.substring(0, 50);
    }
    
    /**
     * Apply a template to the article content
     */
    private applyTemplate(item: FeedItem, template: string): string {
        
        const cleanContent = this.cleanHtml(item.description);
        
        
        const formattedDate = new Date(item.pubDate).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long', 
            day: 'numeric'
        });
        
        
        return template
            .replace(/{{title}}/g, item.title)
            .replace(/{{date}}/g, formattedDate)
            .replace(/{{isoDate}}/g, new Date(item.pubDate).toISOString())
            .replace(/{{link}}/g, item.link)
            .replace(/{{author}}/g, item.author || '')
            .replace(/{{source}}/g, item.feedTitle)
            .replace(/{{summary}}/g, item.summary || '')
            .replace(/{{content}}/g, cleanContent);
    }
    
    /**
     * Create any parent folders needed for the file path
     */
    private async ensureFolderExists(folderPath: string): Promise<void> {
        const folders = folderPath.split('/').filter(p => p.length > 0);
        let currentPath = '';
        
        for (const folder of folders) {
            currentPath += folder;
            
            
            if (!(await this.vault.adapter.exists(currentPath))) {
                await this.vault.createFolder(currentPath);
            }
            
            currentPath += '/';
        }
    }
    
    /**
     * Save an article to the vault
     */
    async saveArticle(
        item: FeedItem, 
        customFolder?: string, 
        customTemplate?: string,
        rawContent?: string
    ): Promise<TFile | null> {
        try {
            
            const folder = customFolder || this.settings.defaultFolder || '';
            
            
            if (folder) {
                await this.ensureFolderExists(folder);
            }
            
            
            const filename = this.sanitizeFilename(item.title);
            const filePath = folder ? `${folder}/${filename}.md` : `${filename}.md`;
            
            
            if (await this.vault.adapter.exists(filePath)) {
                
                await this.vault.adapter.remove(filePath);
            }
            
            
            let content = '';
            
            
            if (this.settings.includeFrontmatter) {
                content += this.generateFrontmatter(item);
            }
            
            if (rawContent) {
                content += rawContent;
            } else {
                
                const template = customTemplate || this.settings.defaultTemplate || 
                    "# {{title}}\n\n{{content}}\n\n[Source]({{link}})";
                content += this.applyTemplate(item, template);
            }
            
            
            const file = await this.vault.create(filePath, content);
            
            
            item.saved = true;
            
            
            if (this.settings.addSavedTag && (!item.tags || !item.tags.some(t => t.name.toLowerCase() === "saved"))) {
                const savedTag = { name: "saved", color: "#3498db" };
                if (!item.tags) {
                    item.tags = [savedTag];
                } else {
                    item.tags.push(savedTag);
                }
            }
            
            new Notice(`Article saved: ${filename}`);
            return file;
        } catch (error) {
            console.error("Error saving article:", error);
            new Notice(`Error saving article: ${error.message}`);
            return null;
        }
    }

    private convertHtmlToMarkdown(html: string): string {
        
        const tmp = document.createElement("div");
        tmp.innerHTML = html;
        
        tmp.querySelectorAll("script, style, iframe").forEach(el => el.remove());

        
        let markdown = this.turndownService.turndown(tmp.innerHTML);

        
        if (/<[a-z][\s\S]*>/i.test(markdown)) {
            
            markdown = tmp.textContent || tmp.innerText || "";
        }

        return markdown.trim();
    }
}

function stripHtml(html: string): string {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}
