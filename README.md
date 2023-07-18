# auth-cookie-storage

### Installation

```bash
yarn add auth-cookie-storage
# or
npm install auth-cookie-storage
```

## Functionalities

You can clear tokens, set new ones, read, decode and check if it's expired (so you refresh them)

## Usage

```tsx
interface User {
    sub: string;
    email: string;
}

const auth = new AuthCookieStorage<User>({ prefix: "@my-app" });

export const CoolPage = () => {
  const [user, setUser] = useState(
    auth.getTokens(document.cookie).decode().user
  );

  return (
    <main>
      <p>{JSON.stringify(user, 2, 2)}</p>

      <button onClick={auth.clearTokens}>Clear tokens</button>
    </main>
  );
};
```

### Examples

<details>
<summary>Next.JS</summary>

#### What needs to be done

1. Take the cookies from \_app.tsx
2. Pass these cookies over to your auth context
3. Use the library from then on

```tsx
// _app.tsx
interface Props extends AppProps {
  request_cookies: string;
}

const App = ({ Component, pageProps, request_cookies }: Props) => {
  return (
    <MainContext request_cookies={request_cookies}>
      <Component {...pageProps} />
    </MainContext>
  );
};

App.getInitialProps = async (app_context: AppContext) => {
  const app_props = await NextApp.getInitialProps(app_context);

  const { ctx } = app_context;

  const cookies = ctx.req?.headers?.cookie || "";

  // Optional redirection logic

  return {
    ...app_props,
    request_cookies: cookies,
  };
};

export default App;

// MainContext.tsx
interface Props {
  request_cookies?: string;
}

export const AppContext = ({
  request_cookies,
  children,
}: React.PropsWithChildren<Props>): JSX.Element => (
  <AuthProvider request_cookies={request_cookies}>{children}</AuthProvider>
);

// AuthProvider.tsx
import { useRouter } from "next/router";
import React, {
  createContext,
  useState,
  useContext,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import AuthCookieStorage from "auth-cookie-storage";

/* ----------- Services ----------- */
import { services } from "_services";

/* ----------- Types ----------- */
import { User } from "_@types/User";
import { AuthenticationContext } from "./@types";

/* ----------- Interfaces ----------- */
interface AuthContextData {
  /**
   * Current logged in user
   */
  user: User;
  setUser: React.Dispatch<React.SetStateAction<User>>;

  handleResetAuth: () => void;

  handleRefreshTokens: () => Promise<void>;
  handleSignIn: ({
    access_token,
    id_token,
    refresh_token,
  }: AuthenticationContext.Handlers.SignIn) => void;

  logged_in: boolean;
}

/* ----------- Contexts ----------- */
const AuthContext = createContext<AuthContextData>({} as AuthContextData);

/* ----------- Interfaces ----------- */
interface Props {
  request_cookies?: string;
  children?: React.ReactNode;
}

const auth = new AuthCookieStorage<User>({
  prefix: "@cool-app",
});

/* ----------- Providers ----------- */
export const AuthProvider: React.FC<Props> = ({
  request_cookies,
  children,
}) => {
  /* ----------- Hooks ----------- */
  const { replace, route, query, push } = useRouter();

  /* ----------- States ----------- */
  const [user, setUser] = useState<User>(
    auth.getTokens(request_cookies).decode().user
  );

  /* ----------- Refs ----------- */
  const session_check = useRef<boolean>(true);

  /* ----------- Callbacks ----------- */
  const handleResetAuth = useCallback(() => {
    auth.clearStorage();

    setUser({} as User);

    session_check.current = true;
  }, []);

  const handleSignIn = useCallback(
    async ({
      access_token,
      id_token,
      refresh_token,
      keep,
    }: AuthenticationContext.Handlers.SignIn) => {
      if (!id_token || !access_token || !refresh_token) return;

      auth.setTokens({
        access_token,
        id_token,
        refresh_token,
        persist: keep,
      });

      const decoded = auth.decode();

      setUser(decoded.user);

      await replace("/protected-page");
    },
    [replace]
  );

  const handleUpdateTokens = useCallback(
    async ({
      access_token,
      refresh_token,
      keep,
    }: AuthenticationContext.Handlers.SignIn) => {
      if (session_check.current) return;
      session_check.current = true;

      try {
        if (!auth.isExpired()) return;

        const { data } = await services.authentication.refresh_tokens({
          access_token,
          refresh_token,
        });

        handleSignIn({ ...data, refresh_token, keep });
      } catch (error) {
        handleResetAuth();

        replace("/login-page");
      }
    },
    [handleResetAuth, handleSignIn, replace, route]
  );

  /* ----------- Effects ----------- */
  useEffect(() => {
    const client_side = typeof window !== "undefined";

    if (!client_side) return undefined;

    const { persist, ...auth_tokens } = auth.getTokens(document.cookie || "");

    if (!auth_tokens.id_token) return undefined;

    handleUpdateTokens({
      ...auth_tokens,
      keep: persist,
    });

    return () => {
      session_check.current = false;
    };
  }, [handleUpdateTokens, route]);

  const value = useMemo(
    () => ({
      user,
      setUser,
      logged_in: !check_object_empty(user),
      handleResetAuth,
      handleSignIn,
    }),
    [user, handleSignIn, handleResetAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
```

</details>
