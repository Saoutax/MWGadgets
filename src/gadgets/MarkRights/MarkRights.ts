import { createMarks } from "./modules/createMarks";
import { getGroups } from "./modules/getGroups";
import groupsList from "./modules/groupsList";

(async() => {
    const groups = await getGroups();
    createMarks(groups, groupsList);
})();
