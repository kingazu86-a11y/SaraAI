export interface ToolParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ToolParameterSchema>;
  requiresPermission?: string[];
  requiresConfirmation?: boolean;
  timeoutMs?: number;
}

export const PREDEFINED_TOOLS: Record<string, ToolDefinition> = {
  open_app: {
    name: 'open_app',
    description: 'Launch an installed Android application by its package name or common app name.',
    parameters: {
      packageName: {
        type: 'string',
        description: 'The Android package name (e.g., com.whatsapp) or app name.',
        required: true,
      },
    },
    requiresConfirmation: false,
    timeoutMs: 5000,
  },
  get_installed_apps: {
    name: 'get_installed_apps',
    description: 'Retrieve a list of all launchable applications installed on the Android device.',
    parameters: {},
    requiresConfirmation: false,
    timeoutMs: 8000,
  },
  open_settings: {
    name: 'open_settings',
    description: 'Open Android system settings or a specific settings screen.',
    parameters: {
      action: {
        type: 'string',
        description: 'Specific settings subpage (e.g., wifi, bluetooth, accessibility, apps).',
        required: false,
      },
    },
    requiresConfirmation: false,
    timeoutMs: 5000,
  },
  get_current_screen: {
    name: 'get_current_screen',
    description: 'Inspect the current screen accessibility tree, visible elements, text, and active package.',
    parameters: {},
    requiresPermission: ['accessibility'],
    requiresConfirmation: false,
    timeoutMs: 5000,
  },
  find_text: {
    name: 'find_text',
    description: 'Search for visible text or content descriptions on the active screen.',
    parameters: {
      text: {
        type: 'string',
        description: 'The exact or partial text to locate on the screen.',
        required: true,
      },
    },
    requiresPermission: ['accessibility'],
    requiresConfirmation: false,
    timeoutMs: 4000,
  },
  click: {
    name: 'click',
    description: 'Simulate a click on a visible UI element by nodeId or text label.',
    parameters: {
      nodeId: {
        type: 'string',
        description: 'The identifier of the node to click.',
        required: false,
      },
      text: {
        type: 'string',
        description: 'The text label of the element to click if nodeId is unknown.',
        required: false,
      },
    },
    requiresPermission: ['accessibility'],
    requiresConfirmation: false,
    timeoutMs: 4000,
  },
  type_text: {
    name: 'type_text',
    description: 'Enter text into an editable input field on the active screen.',
    parameters: {
      nodeId: {
        type: 'string',
        description: 'Target input field nodeId.',
        required: false,
      },
      text: {
        type: 'string',
        description: 'Text string to type into the field.',
        required: true,
      },
    },
    requiresPermission: ['accessibility'],
    requiresConfirmation: false,
    timeoutMs: 5000,
  },
  scroll: {
    name: 'scroll',
    description: 'Scroll the active view in a specified direction (forward/backward/up/down).',
    parameters: {
      direction: {
        type: 'string',
        description: 'Direction to scroll: forward, backward, up, down.',
        enum: ['forward', 'backward', 'up', 'down'],
        required: true,
      },
    },
    requiresPermission: ['accessibility'],
    requiresConfirmation: false,
    timeoutMs: 4000,
  },
  press_back: {
    name: 'press_back',
    description: 'Simulate Android system Back button press.',
    parameters: {},
    requiresPermission: ['accessibility'],
    requiresConfirmation: false,
    timeoutMs: 3000,
  },
  search_files: {
    name: 'search_files',
    description: 'Search for files in accessible Android storage by query or extension.',
    parameters: {
      query: {
        type: 'string',
        description: 'Filename search term.',
        required: true,
      },
      extension: {
        type: 'string',
        description: 'Optional file extension filter (e.g. pdf, doc, mp3).',
        required: false,
      },
    },
    requiresConfirmation: false,
    timeoutMs: 8000,
  },
  get_file_info: {
    name: 'get_file_info',
    description: 'Get metadata about a specific file (size, mime type, last modified).',
    parameters: {
      path: {
        type: 'string',
        description: 'The file path or URI.',
        required: true,
      },
    },
    requiresConfirmation: false,
    timeoutMs: 4000,
  },
  read_text_file: {
    name: 'read_text_file',
    description: 'Read the text content of a local file safely.',
    parameters: {
      path: {
        type: 'string',
        description: 'The file path.',
        required: true,
      },
      maxLines: {
        type: 'number',
        description: 'Maximum lines to read.',
        required: false,
      },
    },
    requiresConfirmation: false,
    timeoutMs: 5000,
  },
  take_screenshot: {
    name: 'take_screenshot',
    description: 'Capture screenshot of current screen via accessibility service for multimodal inspection.',
    parameters: {},
    requiresPermission: ['accessibility'],
    requiresConfirmation: false,
    timeoutMs: 6000,
  },
};
