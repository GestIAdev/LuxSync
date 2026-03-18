export interface Poem {
    id: string;
    text: string;
    author: string;
    theme: string;
    timestamp: number;
}
export declare class PoetryLibrary {
    private poems;
    private themes;
    /**
     * Add poem to library
     */
    addPoem(poem: Poem): void;
    /**
     * Get poem by ID
     */
    getPoem(id: string): Poem | undefined;
    /**
     * Get poems by theme
     */
    getPoemsByTheme(theme: string): Poem[];
    /**
     * Get random poem
     */
    getRandomPoem(): Poem | undefined;
    /**
     * List all themes
     */
    getThemes(): string[];
    /**
     * Clear library
     */
    clear(): void;
    /**
     * Get library size
     */
    size(): number;
}
//# sourceMappingURL=PoetryLibrary.d.ts.map