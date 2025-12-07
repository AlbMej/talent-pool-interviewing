// Skill Tree Visualization using D3.js
interface SkillNode {
    name: string;
    type?: string;
    children?: SkillNode[];
    progress?: number;
}

interface SkillTreeState {
    skillTree: SkillNode | null;
    skillProgress: Map<string, number>;
}

// Declare D3 types
declare const d3: any;

class SkillTreeVisualization {
    private container: HTMLElement;
    private svg: any;
    private g: any;
    private root: any = null;
    private treeLayout: any;
    private state: SkillTreeState;
    private width: number = 0;
    private height: number = 0;
    private margin = { top: 20, right: 120, bottom: 20, left: 120 };

    constructor(container: HTMLElement, state: SkillTreeState) {
        this.container = container;
        this.state = state;
        
        // Initialize SVG
        this.width = container.clientWidth - this.margin.left - this.margin.right;
        this.height = Math.max(600, container.clientHeight) - this.margin.top - this.margin.bottom;
        
        this.svg = d3.select(container)
            .append('svg')
            .attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', this.height + this.margin.top + this.margin.bottom)
            .style('font', '14px sans-serif');
        
        this.g = this.svg.append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
        
        // Set up tree layout
        this.treeLayout = d3.tree<SkillNode>()
            .size([this.height, this.width])
            .separation((a, b) => (a.parent === b.parent ? 1 : 1.5) / a.depth);
    }

    update(tree: SkillNode) {
        // Clear previous render
        this.g.selectAll('*').remove();
        
        // Convert data to hierarchy
        const root = d3.hierarchy(tree);
        this.root = root;
        
        // Calculate tree layout
        this.treeLayout(root);
        
        // Draw links
        this.drawLinks(root);
        
        // Draw nodes
        this.drawNodes(root);
    }

    private drawLinks(root: any) {
        const links = root.links();
        
        const link = this.g.selectAll('.link')
            .data(links)
            .enter()
            .append('path')
            .attr('class', 'link')
            .attr('d', d3.linkHorizontal()
                .x((d: any) => d.y)
                .y((d: any) => d.x))
            .style('fill', 'none')
            .style('stroke', '#e4e4e7')
            .style('stroke-width', 2);
    }

    private drawNodes(root: any) {
        const nodes = root.descendants();
        
        const node = this.g.selectAll('.node')
            .data(nodes)
            .enter()
            .append('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${d.y},${d.x})`);
        
        // Add node circles
        node.append('circle')
            .attr('r', d => {
                if (d.data.type === 'skill' || d.data.type === 'requirement') return 8;
                if (d.children) return 6;
                return 4;
            })
            .style('fill', d => {
                if (d.data.type === 'skill' || d.data.type === 'requirement') {
                    const progress = this.state.skillProgress.get(d.data.name) || 0;
                    if (progress === 100) return '#16a34a';
                    if (progress > 0) return '#3b82f6';
                    return '#e4e4e7';
                }
                return '#f4f4f5';
            })
            .style('stroke', '#09090b')
            .style('stroke-width', 1.5);
        
        // Add node labels
        const labels = node.append('g')
            .attr('class', 'node-label')
            .attr('transform', d => `translate(${d.children ? -13 : 13}, 0)`);
        
        labels.append('text')
            .attr('dy', '.35em')
            .attr('x', d => d.children ? -8 : 8)
            .style('text-anchor', d => d.children ? 'end' : 'start')
            .style('font-size', d => {
                if (d.data.type === 'skill' || d.data.type === 'requirement') return '14px';
                if (d.depth === 0) return '16px';
                return '13px';
            })
            .style('font-weight', d => {
                if (d.data.type === 'skill' || d.data.type === 'requirement') return '600';
                if (d.depth <= 1) return '600';
                return '400';
            })
            .style('fill', '#09090b')
            .text(d => d.data.name);
        
        // Add progress indicators for skills
        nodes.forEach(d => {
            if (d.data.type === 'skill' || d.data.type === 'requirement') {
                const progress = this.state.skillProgress.get(d.data.name) || 0;
                if (progress > 0) {
                    const progressGroup = this.g.append('g')
                        .attr('class', 'progress-indicator')
                        .attr('transform', `translate(${d.y},${d.x})`);
                    
                    const offset = d.children ? -13 : 13;
                    const anchor = d.children ? 'end' : 'start';
                    const xPos = d.children ? -8 : 8;
                    
                    progressGroup.append('rect')
                        .attr('x', d.children ? xPos - 40 : xPos)
                        .attr('y', -6)
                        .attr('width', 40)
                        .attr('height', 4)
                        .attr('rx', 2)
                        .style('fill', '#f4f4f5');
                    
                    progressGroup.append('rect')
                        .attr('x', d.children ? xPos - 40 : xPos)
                        .attr('y', -6)
                        .attr('width', (40 * progress) / 100)
                        .attr('height', 4)
                        .attr('rx', 2)
                        .style('fill', progress === 100 ? '#16a34a' : '#3b82f6')
                        .style('transition', 'width 0.3s ease');
                }
            }
        });
    }

    updateProgress(skillName: string, progress: number) {
        // Update the state
        this.state.skillProgress.set(skillName, progress);
        
        // Re-render to show updated progress
        if (this.state.skillTree) {
            this.update(this.state.skillTree);
        }
    }

    resize() {
        this.width = this.container.clientWidth - this.margin.left - this.margin.right;
        this.height = Math.max(600, this.container.clientHeight) - this.margin.top - this.margin.bottom;
        
        this.svg
            .attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', this.height + this.margin.top + this.margin.bottom);
        
        this.treeLayout.size([this.height, this.width]);
        
        if (this.state.skillTree) {
            this.update(this.state.skillTree);
        }
    }
}

// Export for use in main app
if (typeof window !== 'undefined') {
    (window as any).SkillTreeVisualization = SkillTreeVisualization;
}

