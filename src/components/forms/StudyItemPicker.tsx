import { StatusBadge } from "@/components/cards/StatusBadge";
import type { StudyItem } from "@/types/domain";
import { Box, Checkbox, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";

interface Props {
  items: StudyItem[];
  value: string[];
  onChange: (ids: string[]) => void;
  maxHeight?: string;
}

export function StudyItemPicker({
  items,
  value,
  onChange,
  maxHeight = "200px",
}: Props) {
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? items.filter((i) => i.title.toLowerCase().includes(search.toLowerCase()))
    : items;

  const toggle = (id: string) => {
    onChange(
      value.includes(id) ? value.filter((v) => v !== id) : [...value, id],
    );
  };

  return (
    <Stack w="full" gap={2}>
      <Input
        size="sm"
        placeholder="Search items…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Box
        borderWidth={1}
        borderRadius="md"
        overflowY="auto"
        maxH={maxHeight}
        p={1}
      >
        {filtered.length === 0 ? (
          <Text fontSize="sm" color="fg.muted" px={2} py={3} textAlign="center">
            No items found
          </Text>
        ) : (
          <Stack gap={0}>
            {filtered.map((item) => (
              <HStack
                key={item.id}
                as="label"
                gap={2}
                px={2}
                py={1.5}
                borderRadius="sm"
                _hover={{ bg: "bg.subtle" }}
                cursor="pointer"
                width="full"
              >
                <Checkbox.Root
                  checked={value.includes(item.id)}
                  onCheckedChange={() => toggle(item.id)}
                  flexShrink={0}
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                </Checkbox.Root>
                <HStack gap={2} flex={1} minW={0}>
                  <Text fontSize="sm" flex={1}>
                    {item.title}
                  </Text>
                  <StatusBadge status={item.status} />
                </HStack>
              </HStack>
            ))}
          </Stack>
        )}
      </Box>
      {value.length > 0 && (
        <Text fontSize="xs" color="fg.muted">
          {value.length} item{value.length !== 1 ? "s" : ""} selected
        </Text>
      )}
    </Stack>
  );
}
