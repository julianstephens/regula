import pb from "@/lib/pocketbase";
import {
  Box,
  Button,
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerRoot,
  DrawerTitle,
  Flex,
  Heading,
  HStack,
  IconButton,
  Link,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useState } from "react";
import { LuMenu } from "react-icons/lu";
import { NavLink, Outlet, useNavigate } from "react-router";

const navItems = [
  { label: "Dashboard", to: "/" },
  { label: "Calendar", to: "/calendar" },
  { label: "Homework & Revision", to: "/homework" },
  { label: "Syllabus", to: "/syllabus" },
  { label: "Courses", to: "/courses" },
  { label: "Resources", to: "/resources" },
  { label: "Programs", to: "/programs" },
  { label: "Settings", to: "/settings" },
];

function NavItems({ onClose }: { onClose?: () => void }) {
  return (
    <>
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          onClick={onClose}
        >
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
    </>
  );
}

export default function Root() {
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = () => {
    pb.authStore.clear();
    void navigate("/login");
  };

  return (
    <Flex h="full" flexDir="column">
      {/* Mobile top bar */}
      <HStack
        display={{ base: "flex", md: "none" }}
        px={4}
        py={3}
        bg="bg.subtle"
        borderBottom="1px solid"
        borderColor="border.subtle"
        justify="space-between"
        flexShrink={0}
      >
        <Heading size="md" color="fg">
          <Link href="/">Regula</Link>
        </Heading>
        <IconButton
          aria-label="Open menu"
          variant="ghost"
          size="sm"
          onClick={() => setDrawerOpen(true)}
        >
          <LuMenu />
        </IconButton>
      </HStack>

      <Flex flex={1} overflow="hidden">
        {/* Desktop sidebar */}
        <Box
          id="sidebar"
          w="220px"
          h="full"
          bg="bg.subtle"
          borderRight="1px solid"
          borderColor="border.subtle"
          py={6}
          px={4}
          display={{ base: "none", md: "flex" }}
          flexDir="column"
          flexShrink={0}
        >
          <Heading size="md" mb={8} color="fg">
            <Link href="/">Regula</Link>
          </Heading>
          <VStack align="stretch" gap={1} flex={1}>
            <NavItems />
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
        <Box id="main-content" flex={1} overflow="auto" p={{ base: 4, md: 8 }}>
          <Outlet />
        </Box>
      </Flex>

      {/* Mobile navigation drawer */}
      <DrawerRoot
        open={drawerOpen}
        onOpenChange={(e) => setDrawerOpen(e.open)}
        placement="start"
      >
        <DrawerBackdrop />
        <DrawerContent h="full">
          <DrawerHeader>
            <DrawerTitle>
              <Link href="/">Regula</Link>
            </DrawerTitle>
            <DrawerCloseTrigger />
          </DrawerHeader>
          <DrawerBody display="flex" flexDir="column">
            <VStack align="stretch" gap={1} flex={1}>
              <NavItems onClose={() => setDrawerOpen(false)} />
            </VStack>
            <HStack mt={4} justify="space-between">
              <Text fontSize="sm" color="fg.muted" truncate>
                {pb.authStore.record?.email as string | undefined}
              </Text>
              <Button size="xs" variant="ghost" onClick={handleLogout}>
                Log out
              </Button>
            </HStack>
          </DrawerBody>
        </DrawerContent>
      </DrawerRoot>
    </Flex>
  );
}
