import {useState} from "react";
import {Home,Compass,Bell,Mail,UserRound,Menu,X,Bookmark,Users,Settings,Gem,LogOut,PenSquare} from "lucide-react";
import "./mobile-navigation.css";
type Props={page:string;unread:number;signedIn:boolean;onNavigate:(page:string)=>void;onEditProfile:()=>void;onLogout:()=>void;onCompose:()=>void};
const primary=[{page:"Home",label:"Home",icon:Home},{page:"Explore",label:"Zoeken",icon:Compass},{page:"Notifications",label:"Meldingen",icon:Bell},{page:"Messages",label:"Berichten",icon:Mail}];
const extra=[{page:"Profile",label:"Mijn profiel",icon:UserRound},{page:"Communities",label:"Communities",icon:Users},{page:"Bookmarks",label:"Opgeslagen",icon:Bookmark},{page:"Premium",label:"Premium",icon:Gem},{page:"Settings",label:"Instellingen",icon:Settings}];
export function MobileNavigation({page,unread,signedIn,onNavigate,onEditProfile,onLogout,onCompose}:Props){
 const [open,setOpen]=useState(false);
 const go=(p:string)=>{onNavigate(p);setOpen(false)};
 return <div className="mingle-mobile-navigation">
  {open&&<><button className="mingle-mobile-shade" aria-label="Menu sluiten" onClick={()=>setOpen(false)}/><section className="mingle-mobile-sheet" aria-label="Meer navigatie"><div className="mingle-mobile-sheet-title"><strong>Menu</strong><button aria-label="Sluiten" onClick={()=>setOpen(false)}><X size={22}/></button></div><div className="mingle-mobile-sheet-grid">{extra.map(({page:p,label,icon:Icon})=><button key={p} className={page===p?"selected":""} onClick={()=>go(p)}><Icon size={21}/>{label}</button>)}{signedIn&&<><button onClick={()=>{setOpen(false);onEditProfile()}}><UserRound size={21}/>Profiel bewerken</button><button onClick={()=>{setOpen(false);onCompose()}}><PenSquare size={21}/>Bericht plaatsen</button><button onClick={()=>{setOpen(false);onLogout()}}><LogOut size={21}/>Uitloggen</button></>}</div></section></>}
  <nav className="mingle-mobile-tabs" aria-label="Mobiele navigatie">{primary.map(({page:p,label,icon:Icon})=><button key={p} className={page===p?"selected":""} onClick={()=>go(p)} aria-label={label} aria-current={page===p?"page":undefined}><Icon size={23}/><span>{label}</span>{p==="Notifications"&&unread>0&&<i>{unread>99?"99+":unread}</i>}</button>)}<button className={open||extra.some(x=>x.page===page)?"selected":""} onClick={()=>setOpen(v=>!v)} aria-label="Meer opties" aria-expanded={open}><Menu size={23}/><span>Meer</span></button></nav>
 </div>;
}
