import paramiko


class SSHClient:
    def __init__(self, host: str, port: int, user: str, key_path: str) -> None:
        self._host = host
        self._port = port
        self._user = user
        self._key_path = key_path
        self._client: paramiko.SSHClient | None = None

    def _connect(self) -> None:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        key = paramiko.Ed25519Key.from_private_key_file(self._key_path)
        client.connect(
            hostname=self._host,
            port=self._port,
            username=self._user,
            pkey=key,
            timeout=30,
        )
        self._client = client

    def execute(self, command: str) -> str:
        if self._client is None:
            self._connect()
        assert self._client is not None
        _, stdout, stderr = self._client.exec_command(command)
        output = stdout.read().decode()
        exit_code = stdout.channel.recv_exit_status()
        if exit_code != 0:
            err = stderr.read().decode().strip()
            raise RuntimeError(f"SSH command failed (exit {exit_code}): {err}")
        return output

    def close(self) -> None:
        if self._client:
            self._client.close()
            self._client = None

    def __enter__(self) -> "SSHClient":
        return self

    def __exit__(self, *_) -> None:
        self.close()
