// /profile «La carta»: the Celeste chrome (header with «Tu perfil», the dock and the footer, like the
// vestuario and the pizarra) around ProfileView, wired to the real data (useProfileData) and the
// profile's callables. Members only: the layout shows the door to everybody else.
import { CelesteDock, CelesteFooter, CelesteHeader } from "../../components/celeste/Chrome";
import { ThemeToggle } from "../../components/ThemeToggle";
import { useClock } from "../../hooks/useClock";
import { useAuth } from "../../context/AuthContext";
import { leaveDoorNotice } from "../../lib/doorNotice";
import { savedTopics, setTopics } from "../../lib/push";
import { cancelPlayerClaim, leaveVestuario, nicknameTaken, proposePositions, requestPlayerClaim, setNickname, setShirtName } from "./api";
import { ProfileView, type ProfileActions } from "./ProfileView";
import { useProfileData } from "./useProfileData";
import "../../styles/perfil.css";
import "../../styles/perfil-app.css";

export function ProfilePage() {
  const data = useProfileData();
  const { logout } = useAuth();
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
    proposePositions: async (set) => {
      const playerId = data.ficha.state === "vinculada" ? data.ficha.playerId : null;
      if (!playerId) throw new Error("Sin ficha vinculada");
      await proposePositions(playerId, set);
    },
    signOut: async () => {
      leaveDoorNotice("Has salido en este dispositivo");
      await logout();
    },
    leaveVestuario: async () => {
      await leaveVestuario({ confirm: true });
      // The server dropped this account's notices: this device forgets its topics too (best effort).
      if (savedTopics().length) void setTopics([]).catch(() => undefined);
      leaveDoorNotice("Te has dado de baja del vestuario. Para volver, un capitán tendrá que abrirte otra vez.");
      await logout();
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
          actions={<ThemeToggle />}
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
