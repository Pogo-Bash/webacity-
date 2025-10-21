import { defineStore } from 'pinia'

export const useHistoryStore = defineStore('history', {
  state: () => ({
    undoStack: [],
    redoStack: [],
    maxHistorySize: 50
  }),

  getters: {
    canUndo: (state) => state.undoStack.length > 0,
    canRedo: (state) => state.redoStack.length > 0
  },

  actions: {
    /**
     * Execute a command and add it to history
     */
    execute(command) {
      command.execute()
      this.undoStack.push(command)
      this.redoStack = [] // Clear redo stack when new action is performed

      // Limit history size
      if (this.undoStack.length > this.maxHistorySize) {
        this.undoStack.shift()
      }
    },

    /**
     * Undo last command
     */
    undo() {
      if (!this.canUndo) return

      const command = this.undoStack.pop()
      command.undo()
      this.redoStack.push(command)
    },

    /**
     * Redo last undone command
     */
    redo() {
      if (!this.canRedo) return

      const command = this.redoStack.pop()
      command.execute()
      this.undoStack.push(command)
    },

    /**
     * Clear all history
     */
    clear() {
      this.undoStack = []
      this.redoStack = []
    }
  }
})
