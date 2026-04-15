import { useSelector } from 'react-redux';
import { RootState } from '../roomStore';

export const useMessageHeapState = () => {
  const rawQueue = useSelector(
    (state: RootState) => state.roomHeapSlice.messageHeap
  );
  const queue = Array.isArray(rawQueue)
    ? rawQueue.filter(
        (message): message is RootState['roomHeapSlice']['messageHeap'][number] =>
          Boolean(message) && typeof message === 'object'
      )
    : [];
  const idSet = new Set(queue.map((m) => m.id));

  return { queue, idSet };
};
