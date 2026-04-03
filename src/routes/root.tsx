import pb from "@/lib/pocketbase";
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Link,
  Text,
  VStack,
} from "@chakra-ui/react";
import { NavLink, Outlet, useNavigate } from "react-router";

const navItems = [
  { label: "Dashboard", to: "/" },
  { label: "Programs", to: "/programs" },
  { label: "Areas", to: "/areas" },
  { label: "Resources", to: "/resources" },
  { label: "Study Items", to: "/study-items" },
  { label: "Sessions", to: "/sessions" },
  { label: "Timeline", to: "/timeline" },
  { label: "Settings", to: "/settings" },
];

export default function Root() {
  const navigate = useNavigate();

  const handleLogout = () => {
    pb.authStore.clear();
    void navigate("/login");
  };

  return (
    <Flex h="100vh">
      {/* Sidebar */}
      <Box
        id="sidebar"
        w="220px"
        h="full"
        bg="bg.subtle"
        borderRight="1px solid"
        borderColor="border.subtle"
        py={6}
        px={4}
        display="flex"
        flexDir="column"
        flexShrink={0}
      >
        <Heading size="md" mb={8} color="fg">
          <Link href="/">Regula</Link>
        </Heading>
        <VStack align="stretch" gap={1} flex={1}>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"}>
              {({ isActive }) => (
                <Text
                  px={3}
                  py={2}
                  borderRadius="md"
                  fontWeight={isActive ? "semibold" : "normal"}
                  bg={isActive ? "colorPalette.subtle" : "transparent"}
                  color={isActive ? "colorPalette.fg" : "fg.muted"}
                  _hover={{ bg: "bg.muted", color: "fg" }}
                  transition="all 0.15s"
                >
                  {item.label}
                </Text>
              )}
            </NavLink>
          ))}
        </VStack>
        <HStack mt={4} justify="space-between">
          <Text fontSize="sm" color="fg.muted" truncate>
            {pb.authStore.record?.email as string | undefined}
          </Text>
          <Button size="xs" variant="ghost" onClick={handleLogout}>
            Log out
          </Button>
        </HStack>
      </Box>

      {/* Main content */}
      <Box flex={1} overflow="auto" p={8}>
        <Outlet />
      </Box>
    </Flex>
  );
}
