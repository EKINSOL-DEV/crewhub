import { createContext, useContext, useCallback, type ReactNode } from 'react'

interface TaskBoardContextValue {
  openTaskBoard: () => void
}

const TaskBoardContext = createContext<TaskBoardContextValue>({
  openTaskBoard: () => {},
})

interface TaskBoardProviderProps {
  children: ReactNode
  onOpen: () => void
}

export function TaskBoardProvider({ children, onOpen }: TaskBoardProviderProps) {
  const openTaskBoard = useCallback(() => {
    onOpen()
  }, [onOpen])

  return (
    <TaskBoardContext.Provider value={{ openTaskBoard }}>
      {children}
    </TaskBoardContext.Provider>
  )
}

export function useTaskBoard() {
  return useContext(TaskBoardContext)
}
