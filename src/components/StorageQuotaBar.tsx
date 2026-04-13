import { Box, HStack, Stack, Text } from "@chakra-ui/react";

interface Props {
  used: number;
  quota: number;
}

function formatBytes(bytes: number): string {
  const mb = bytes / 1_048_576;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(1)} MB`;
}

export function StorageQuotaBar({ used, quota }: Props) {
  const percent = quota > 0 ? Math.min((used / quota) * 100, 100) : 0;
  const trackColor =
    percent >= 90 ? "#EF4444" : percent >= 70 ? "#F97316" : "#22C55E";

  return (
    <Stack gap={2}>
      <HStack justify="space-between">
        <Text fontSize="sm" color="fg.muted">
          Storage used
        </Text>
        <Text fontSize="sm" fontWeight="medium">
          {formatBytes(used)} of {formatBytes(quota)}
        </Text>
      </HStack>
      <Box h="8px" borderRadius="full" bg="bg.muted" overflow="hidden">
        <Box
          h="full"
          w={`${percent}%`}
          borderRadius="full"
          style={{ backgroundColor: trackColor, transition: "width 0.3s" }}
        />
      </Box>
      {percent >= 90 && (
        <Text fontSize="xs" color="red.500">
          Storage nearly full. Consider removing attachments from graded
          assessments.
        </Text>
      )}
      {percent >= 70 && percent < 90 && (
        <Text fontSize="xs" color="orange.500">
          Approaching storage limit.
        </Text>
      )}
    </Stack>
  );
}
