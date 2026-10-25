import { ITaskItem, IImageFile, TaskStatus } from './types'

export const isTaskSavable = (task: ITaskItem): task is ITaskItem & { optimized: IImageFile } => (
  task.status === TaskStatus.DONE && !!task.optimized
)

export const isTaskSizeIncreased = ({ image, optimized }: ITaskItem) => (
  optimized && optimized.size >= image.size
)
