import { Box, Icon, Image } from "@chakra-ui/react";
import PawIcon from "@/icons/paw.svg";

type TPetImageProps = {
  src?: string;
  alt: string;
};

export function PetImage({ src, alt }: TPetImageProps) {
  if (src) {
    return <Image src={src} alt={alt} objectFit="cover" w="full" h="full" />;
  }
  return (
    <Box
      w="full"
      h="full"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bgGradient="to-br"
      gradientFrom="secondary.600"
      gradientTo="secondary.800"
      color="primary.400"
    >
      <Icon boxSize="25%" opacity={0.55}>
        <PawIcon />
      </Icon>
    </Box>
  );
}
