import { IconLayoutDashboard, IconBuildingStore, IconTargetArrow, IconPhoto, IconWorld, IconChartBar, IconCode, IconUsers } from "@tabler/icons-react";

const Menuitems: Array<{id?:string;navlabel?:boolean;subheader?:string;title?:string;icon?:typeof IconWorld;href?:string;children?:never[]}> = [
  { navlabel: true, subheader: "Workspace" },
  { id: "overview", title: "Overview", icon: IconLayoutDashboard, href: "/" },
  { id: "campaigns", title: "Campaigns", icon: IconTargetArrow, href: "/campaigns" },
  { id: "creatives", title: "Creatives", icon: IconPhoto, href: "/creatives" },
  { navlabel: true, subheader: "Inventory" },
  { id: "advertisers", title: "Advertisers", icon: IconBuildingStore, href: "/advertisers" },
  { id: "properties", title: "Websites & apps", icon: IconWorld, href: "/properties" },
  { id: "placements", title: "Placements", icon: IconCode, href: "/placements" },
  { navlabel: true, subheader: "Insights" },
  { id: "reports", title: "Reports", icon: IconChartBar, href: "/reports" },
  { navlabel: true, subheader: "Administration" },
  { id: "users", title: "Users", icon: IconUsers, href: "/users" },
];

export default Menuitems;
