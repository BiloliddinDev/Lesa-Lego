import path from "path";
import YAML from "yamljs";

const swaggerPath = path.join(__dirname, "../../docs/swagger.yaml");

export const swaggerDocument = YAML.load(swaggerPath);
