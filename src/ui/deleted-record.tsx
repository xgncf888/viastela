import { Button } from './Button';
import { Sheet } from './Sheet';
import { Text } from './Text';

export const DELETED_RECORD_MESSAGE = '这条记录已在其他设备删除';

/** Shown when an upsert hits a soft-deleted id. Close is the only action. */
export function DeletedRecordNotice({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text variant="heading">{DELETED_RECORD_MESSAGE}</Text>
      <Button label="关闭" onPress={onClose} />
    </Sheet>
  );
}
