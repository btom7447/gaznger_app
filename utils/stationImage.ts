import { ImageSourcePropType } from "react-native";

const STATION_IMAGES: Array<{ keys: string[]; src: ImageSourcePropType }> = [
  { keys: ["total"],              src: require("../assets/images/stations/total_energies.jpg") },
  { keys: ["mobil", "mobile"],   src: require("../assets/images/stations/mobile_services.webp") },
  { keys: ["oando"],             src: require("../assets/images/stations/oando_station.jpg") },
  { keys: ["nnpc", "nipco"],     src: require("../assets/images/stations/nnpc_station.jpg") },
  { keys: ["forte"],             src: require("../assets/images/stations/forte_oil_station.webp") },
  { keys: ["rain"],              src: require("../assets/images/stations/rain_oil_station.jpg") },
  { keys: ["conoil"],            src: require("../assets/images/stations/conoil_station.webp") },
];

const PLACEHOLDER: ImageSourcePropType = require("../assets/images/stations/placeholder_station.jpg");

export function getStationLocalImage(name: string): ImageSourcePropType {
  const lower = name.toLowerCase();
  for (const { keys, src } of STATION_IMAGES) {
    if (keys.some((k) => lower.includes(k))) return src;
  }
  return PLACEHOLDER;
}
