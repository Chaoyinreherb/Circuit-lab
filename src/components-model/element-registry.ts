import { CircuitElement, ElementType, Pin } from './element-base';
import { PRIMITIVE_TEMPLATES, ElementTemplate, createElementFromTemplate, generateElementId } from './primitive-elements';
import { CustomComponentDefinition, PRESET_CUSTOM_DEFINITIONS } from './custom-element-schema';

export class ElementRegistry {
  private templates: Map<string, ElementTemplate> = new Map();
  private customDefinitions: Map<string, CustomComponentDefinition> = new Map();

  constructor() {
    // 1. Register primitives
    PRIMITIVE_TEMPLATES.forEach(t => {
      this.templates.set(t.type, t);
    });

    // 2. Register built-in custom definitions
    PRESET_CUSTOM_DEFINITIONS.forEach(def => {
      this.registerCustomDefinition(def);
    });

    // 3. Load user-saved custom definitions from localStorage if available
    this.loadFromStorage();
  }

  getTemplates(): ElementTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplate(typeOrId: string): ElementTemplate | undefined {
    return this.templates.get(typeOrId);
  }

  getCustomDefinitions(): CustomComponentDefinition[] {
    return Array.from(this.customDefinitions.values());
  }

  /**
   * Register a custom component definition (JSON)
   */
  registerCustomDefinition(def: CustomComponentDefinition): boolean {
    try {
      this.customDefinitions.set(def.typeId, def);

      let template: ElementTemplate;

      if (def.kind === 'parametric') {
        template = {
          type: def.baseType as ElementType,
          customTypeId: def.typeId,
          name: def.name,
          category: def.category as any,
          description: def.description || 'Custom parametric component',
          defaultParams: { ...def.params },
          pins: def.pins.map(p => ({ ...p })),
          symbolColor: def.color
        };
      } else {
        // subcircuit
        template = {
          type: 'subcircuit',
          customTypeId: def.typeId,
          name: def.name,
          category: def.category as any,
          description: def.description || 'Custom subcircuit module',
          defaultParams: {
            definitionId: def.typeId,
            ...def.internalElements.reduce((acc, el) => {
              acc[`${el.id}_params`] = el.params;
              return acc;
            }, {} as Record<string, any>)
          },
          pins: def.pins.map(p => ({ ...p })),
          symbolColor: def.color || '#8b5cf6'
        };
      }

      this.templates.set(def.typeId, template);
      this.saveToStorage();
      return true;
    } catch (e) {
      console.error('Failed to register custom definition:', e);
      return false;
    }
  }

  /**
   * Remove a custom definition
   */
  removeCustomDefinition(typeId: string): boolean {
    if (this.customDefinitions.has(typeId)) {
      this.customDefinitions.delete(typeId);
      this.templates.delete(typeId);
      this.saveToStorage();
      return true;
    }
    return false;
  }

  /**
   * Instantiate element by template or custom type
   */
  createElement(typeOrId: string, x: number, y: number): CircuitElement | null {
    const template = this.templates.get(typeOrId);
    if (!template) return null;
    const elem = createElementFromTemplate(template, x, y);
    if (template.symbolColor) {
      elem.color = template.symbolColor;
    }
    return elem;
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const customs = Array.from(this.customDefinitions.values()).filter(
        d => !PRESET_CUSTOM_DEFINITIONS.some(p => p.typeId === d.typeId)
      );
      localStorage.setItem('circuit_lab_custom_components', JSON.stringify(customs));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('circuit_lab_custom_components');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          parsed.forEach((def: CustomComponentDefinition) => {
            this.registerCustomDefinition(def);
          });
        }
      }
    } catch (e) {
      console.warn('LocalStorage load failed:', e);
    }
  }
}

export const registry = new ElementRegistry();
