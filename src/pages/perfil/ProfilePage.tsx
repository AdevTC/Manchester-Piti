// /profile «La carta»: the Celeste chrome (header with «Tu perfil», the dock and the footer, like the
// vestuario and the pizarra) around ProfileView, wired to the real data (useProfileData) and the
// profile's callables. Members only: the layout shows the door to everybody else.
import { Link } from "@tanstack/react-router";
import { CelesteDock, CelesteFooter, CelesteHeader } from "../../components/celeste/Chrome";
import { Icon } from "../../components/celeste/icons";
import { ThemeToggle } from "../../components/ThemeToggle";
import { useClock } from "../../hooks/useClock";
import { cancelPlayerClaim, nicknameTaken, requestPlayerClaim, setNickname, setShirtName } from "./api";
import { ProfileView, type ProfileActions } from "./ProfileView";
import { useProfileData } from "./useProfileData";
import "../../styles/perfil.css";
import "../../styles/perfil-app.css";

export function ProfilePage() {
  const data = useProfileData();
  const now = useClock(60_000);
  const uid = data.uid;
  const actions: ProfileActions = {
    setShirtName: async (name) => (await setShirtName({ name })).data,
    setNickname: async (nickname) => (await setNickname({ nickname })).data.nickname,
    nicknameTaken: (nick) => nicknameTaken(nick, uid),
    cancelClaim: async () => {
      await cancelPlayerClaim({});
    },
    requestClaim: async (playerId) => {
      const r = await requestPlayerClaim({ playerId });
      return { linked: r.data.linked };
    },
  };
  return (
    <ProfileView
      data={data}
      actions={actions}
      now={now}
      origin={typeof window === "undefined" ? "" : window.location.origin}
      header={
        <CelesteHeader
          active="vestuario"
          sub="Tu perfil"
          actions={
            <>
              <ThemeToggle />
              <Link className="pc-cta-top" to="/vestuario">
                <Icon name="padlock" size={16} stroke={2.2} />
                <span>Vestuario</span>
              </Link>
            </>
          }
        />
      }
      footer={
        <>
          <CelesteFooter />
          <CelesteDock active="vestuario" />
        </>
      }
    />
  );
}
