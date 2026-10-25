// phosphor-react-native's icon source (imported per icon for bundle size)
// passes a web-only `className` to <Svg>. react-native-svg ignores it on
// native; this lets the strict type-check accept it.
import "react-native-svg";

declare module "react-native-svg" {
  interface SvgProps {
    className?: string;
  }
}
