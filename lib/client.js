window.__ModuleLoader__.load({
  id: "dsh-prompt-edit",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    const React = require("react");

    function codec(schema) {
      return { mode: "strict", typeSymbol: "dsh-prompt-edit", schema, create: () => schema };
    }

    const str = {
      parse(value) {
        if (typeof value !== "string") throw new TypeError("expected string");
        return value;
      },
    };
    const num = {
      parse(value) {
        if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError("expected number");
        return value;
      },
    };
    const literal = (expected) => ({
      parse(value) {
        if (value !== expected) throw new TypeError(`expected ${String(expected)}`);
        return value;
      },
    });
    const oneOf = (values) => ({
      parse(value) {
        if (!values.includes(value)) throw new TypeError("unexpected value");
        return value;
      },
    });
    function obj(shape) {
      return {
        parse(value) {
          if (typeof value !== "object" || value === null || Array.isArray(value)) {
            throw new TypeError("expected object");
          }
          const out = {};
          for (const key of Object.keys(shape)) {
            if (!Object.hasOwn(value, key)) throw new TypeError(`missing field ${key}`);
            out[key] = shape[key].parse(value[key]);
          }
          return out;
        },
      };
    }
    function unionOf(...variants) {
      return {
        parse(value) {
          for (const variant of variants) {
            try {
              return variant.parse(value);
            } catch {
              // try next
            }
          }
          throw new TypeError("no union variant matched");
        },
      };
    }

    const resolveResult = unionOf(
      obj({ ok: literal(true), mode: oneOf(["fork", "fresh"]), childId: str, oldSessionId: str }),
      obj({ ok: literal(false), error: str }),
    );

    const detachResult = unionOf(
      obj({ ok: literal(true) }),
      obj({ ok: literal(false), error: str }),
    );

    const TYPERT_REMOTE = {
      package: "dsh-prompt-edit",
      descriptors: [
        {
          id: "dsh-prompt-edit#promptEdit/resolve",
          service: "promptEdit",
          namespace: "promptEdit",
          method: "resolve",
          invocation: { kind: "direct" },
          parameters: [
            { name: "sessionId", wire: "sessionId", source: "json", codec: codec(str) },
            { name: "seq", wire: "seq", source: "json", codec: codec(num) },
            { name: "text", wire: "text", source: "json", codec: codec(str) },
          ],
          result: codec(resolveResult),
        },
        {
          id: "dsh-prompt-edit#promptEdit/detach",
          service: "promptEdit",
          namespace: "promptEdit",
          method: "detach",
          invocation: { kind: "direct" },
          parameters: [
            { name: "sessionId", wire: "sessionId", source: "json", codec: codec(str) },
          ],
          result: codec(detachResult),
        },
      ],
    };

    const DICTIONARY = {
      en: {
        editPrompt: "Edit prompt",
        copy: "Copy",
        copied: "Copied",
        cancel: "Cancel",
        update: "Update",
        updating: "Updating...",
        emptyPrompt: "Prompt cannot be empty",
        editPreserved: "preserved in edit",
        imageAttachment: "Image attachment",
        fileAttachment: "File attachment",
        serviceUnavailable: "Edit service unavailable",
        cannotLocate: "Cannot locate message position",
        resolveError: "Cannot resolve edit boundary",
      },
      ru: {
        editPrompt: "Редактировать промпт",
        copy: "Копировать",
        copied: "Скопировано",
        cancel: "Отмена",
        update: "Обновить",
        updating: "Обновление...",
        emptyPrompt: "Промпт не может быть пустым",
        editPreserved: "сохраняется при редактировании",
        imageAttachment: "Изображение",
        fileAttachment: "Файл",
        serviceUnavailable: "Сервис редактирования недоступен",
        cannotLocate: "Не удалось определить позицию сообщения",
        resolveError: "Ошибка определения границы редактирования",
      },
      zh: {
        editPrompt: "编辑提示词",
        copy: "复制",
        copied: "已复制",
        cancel: "取消",
        update: "更新",
        updating: "更新中...",
        emptyPrompt: "提示词不能为空",
        editPreserved: "编辑时保留",
        imageAttachment: "图片附件",
        fileAttachment: "文件附件",
        serviceUnavailable: "编辑服务不可用",
        cannotLocate: "无法定位消息位置",
        resolveError: "无法确定编辑边界",
      },
    };

    let activeLocale = "en";
    function detectLocale(ctx) {
      const supported = Object.keys(DICTIONARY);
      let raw = "";
      try {
        if (ctx && ctx.locale && typeof ctx.locale.active === "string") {
          raw = ctx.locale.active.toLowerCase().trim();
        }
      } catch (_) {}
      if (!raw) {
        try {
          if (typeof navigator !== "undefined" && typeof navigator.language === "string") {
            raw = navigator.language.toLowerCase().trim();
          }
        } catch (_) {}
      }
      if (!raw) return "en";

      if (supported.includes(raw)) return raw;
      const lang = raw.split(/[-_]/)[0];
      if (supported.includes(lang)) return lang;
      return "en";
    }

    function t(key) {
      const dict = DICTIONARY[activeLocale] || DICTIONARY.en;
      return dict[key] || DICTIONARY.en[key] || key;
    }

    function parseContentParts(content) {
      const texts = [];
      const attachments = [];
      if (typeof content === "string") {
        texts.push(content);
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (!block) continue;
          if (block.type === "text" && typeof block.text === "string") {
            texts.push(block.text);
          } else if (block.type === "image" || block.type === "file") {
            attachments.push(block);
          }
        }
      }
      return {
        text: texts.join(""),
        attachments,
      };
    }

    async function writeClipboard(text) {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch {
          // fallback
        }
      }
      try {
        const el = document.createElement("textarea");
        el.value = text;
        el.setAttribute("readonly", "");
        el.style.position = "fixed";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        const ok = document.execCommand("copy");
        el.remove();
        return ok;
      } catch {
        return false;
      }
    }

    const CopyIcon = () =>
      React.createElement(
        "svg",
        {
          width: 15,
          height: 15,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        },
        React.createElement("rect", { x: 9, y: 9, width: 13, height: 13, rx: 2, ry: 2 }),
        React.createElement("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" }),
      );

    const PencilIcon = () =>
      React.createElement(
        "svg",
        {
          width: 15,
          height: 15,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        },
        React.createElement("path", { d: "M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" }),
      );

    const CheckIcon = () =>
      React.createElement(
        "svg",
        {
          width: 15,
          height: 15,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        },
        React.createElement("polyline", { points: "20 6 9 17 4 12" }),
      );

    const STYLE_ID = "dsh-prompt-edit-styles";
    function ensureStyles() {
      if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
      const styleEl = document.createElement("style");
      styleEl.id = STYLE_ID;
      styleEl.textContent = `
        .dsh-icon-btn {
          appearance: none;
          border: none;
          background: transparent;
          color: var(--dsw-alias-label-tertiary, #9ca3af);
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
          padding: 0;
        }
        .dsh-icon-btn:hover {
          color: var(--dsw-alias-label-primary, #fff) !important;
          background: var(--dsw-alias-bg-module-platform, rgba(127,127,127,.2)) !important;
        }
        .dsh-cancel-btn {
          appearance: none;
          border: none;
          background: transparent;
          color: var(--dsw-alias-label-secondary, #cfd3d6);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          padding: 8px 16px;
          border-radius: 18px;
          height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .dsh-cancel-btn:hover {
          background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,0.08)) !important;
          color: var(--dsw-alias-label-primary, #f9fafb) !important;
        }
        .dsh-update-btn {
          appearance: none;
          border: none;
          font-size: 14px;
          border-radius: 18px;
          height: 36px;
          padding: 8px 22px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          transition: filter 0.15s ease, background 0.15s ease;
        }
        .dsh-update-btn:not(:disabled):hover {
          filter: brightness(1.12);
        }
      `;
      document.head.appendChild(styleEl);
    }

    const style = {
      row: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 6,
        minWidth: 0,
        width: "100%",
        position: "relative",
      },
      bubble: {
        maxWidth: "min(640px, 100%)",
        background: "var(--dsw-alias-bg-module-platform, rgba(127,127,127,.14))",
        borderRadius: 20,
        padding: "10px 18px",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        color: "inherit",
        fontSize: 15,
        lineHeight: 1.6,
      },
      actions: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginTop: 2,
        paddingRight: 4,
      },
      editBubble: {
        width: "min(640px, 100%)",
        border: "1.5px solid var(--dsw-alias-button-info-fill, #679efe)",
        borderRadius: 24,
        padding: "12px 18px",
        background: "var(--dsw-alias-bg-module-platform, #353638)",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      },
      textarea: {
        width: "100%",
        boxSizing: "border-box",
        resize: "none",
        minHeight: 48,
        background: "transparent",
        color: "var(--dsw-alias-label-primary, #f9fafb)",
        border: "none",
        outline: "none",
        fontFamily: "inherit",
        fontSize: 15,
        lineHeight: 1.6,
        padding: 0,
        margin: 0,
      },
      editActionsRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 10,
        marginTop: 8,
        paddingRight: 4,
        alignSelf: "flex-end",
      },
      status: {
        fontSize: 12,
        color: "var(--dsw-alias-label-tertiary, #adb2b8)",
        marginTop: 4,
        alignSelf: "flex-end",
        paddingRight: 4,
      },
      error: {
        fontSize: 12,
        color: "var(--dsw-alias-state-error-primary, #ef4444)",
        marginTop: 4,
        alignSelf: "flex-end",
        paddingRight: 4,
      },
    };

    function renderAttachmentsList(items, isEditing) {
      if (!items || items.length === 0) return null;
      return React.createElement(
        "div",
        {
          style: {
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            alignSelf: "flex-end",
            marginBottom: 4,
          },
        },
        items.map((block, idx) => {
          const isImg = block.type === "image";
          const att = block.attachment || block;
          const defaultLabel = isImg ? t("imageAttachment") : t("fileAttachment");
          const name = att.name || defaultLabel;
          return React.createElement(
            "span",
            {
              key: idx,
              style: {
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: 12,
                background: "var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,0.08))",
                fontSize: 12,
                color: isEditing
                  ? "var(--dsw-alias-button-info-fill, #679efe)"
                  : "var(--dsw-alias-label-secondary, #cfd3d6)",
                border: isEditing ? "1px solid rgba(103,158,254,0.3)" : "1px solid rgba(255,255,255,0.1)",
                maxWidth: 260,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              },
              title: name + (isEditing ? ` (${t("editPreserved")})` : ""),
            },
            (isImg ? "📷 " : "📄 ") + name + (isEditing ? " ✓" : ""),
          );
        }),
      );
    }

    function PromptEditUserNode(props) {
      const node = props.node;
      const sessionId = props.sessionId;
      const resolve = props.resolve;
      const detach = props.detach;
      const platform = props.platform;

      const content = node && node.data && node.data.content;
      const { text, attachments } = parseContentParts(content);

      const [editing, setEditing] = React.useState(false);
      const [draft, setDraft] = React.useState(text);
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState(null);
      const [copied, setCopied] = React.useState(false);
      const textareaRef = React.useRef(null);
      const mounted = React.useRef(true);
      const copyTimer = React.useRef(null);

      React.useEffect(
        () => () => {
          mounted.current = false;
          if (copyTimer.current !== null) {
            window.clearTimeout(copyTimer.current);
            copyTimer.current = null;
          }
        },
        [],
      );

      React.useEffect(() => {
        setDraft(text);
      }, [text]);

      React.useEffect(() => {
        if (editing && textareaRef.current) {
          const ta = textareaRef.current;
          ta.style.height = "auto";
          ta.style.height = ta.scrollHeight + "px";
          ta.focus();
          const len = ta.value.length;
          ta.setSelectionRange(len, len);
        }
      }, [editing]);

      const handleInput = (e) => {
        const val = e.target.value;
        setDraft(val);
        e.target.style.height = "auto";
        e.target.style.height = e.target.scrollHeight + "px";
      };

      const copy = async () => {
        if (copied || copyTimer.current !== null) return;
        const ok = await writeClipboard(text);
        if (!mounted.current || !ok) return;
        setCopied(true);
        copyTimer.current = window.setTimeout(() => {
          copyTimer.current = null;
          if (mounted.current) setCopied(false);
        }, 1200);
      };

      const begin = () => {
        setError(null);
        setDraft(text);
        setEditing(true);
      };

      const cancel = () => {
        setError(null);
        setDraft(text);
        setEditing(false);
      };

      const confirmEdit = async () => {
        if (busy) return;
        const next = draft;
        if (typeof next !== "string" || next.trim() === "") {
          setError(t("emptyPrompt"));
          return;
        }
        if (!sessionId || !node || typeof node.anchorSeq !== "number") {
          setError(t("cannotLocate"));
          return;
        }
        if (!resolve) {
          setError(t("serviceUnavailable"));
          return;
        }

        setBusy(true);
        setError(null);
        try {
          const resolved = await resolve(node.anchorSeq, next);
          if (!resolved || resolved.ok !== true || resolved.value === undefined) {
            const detail = resolved && resolved.error;
            throw new Error((detail && (detail.message || detail)) || t("resolveError"));
          }
          const outcome = resolved.value;
          if (outcome.ok !== true) {
            throw new Error(outcome.error || t("resolveError"));
          }

          const childId = outcome.childId;
          if (!childId) throw new Error("No child session created");

          if (platform && typeof platform.openSession === "function") {
            platform.openSession(childId);
          }

          if (outcome.oldSessionId && detach) {
            try {
              await detach(outcome.oldSessionId);
            } catch (_) {}
          }
        } catch (e) {
          if (mounted.current) setError(String((e && e.message) || e));
        } finally {
          if (mounted.current) setBusy(false);
        }
      };

      if (editing) {
        const isChanged = draft.trim() !== "" && draft.trim() !== text.trim();
        return React.createElement(
          "div",
          { style: style.row },
          renderAttachmentsList(attachments, true),
          React.createElement(
            "div",
            { style: style.editBubble },
            React.createElement("textarea", {
              ref: textareaRef,
              style: style.textarea,
              value: draft,
              disabled: busy,
              onChange: handleInput,
              onKeyDown: (e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  // ignore enter while IME composition is active (cjk input)
                  if (e.nativeEvent && e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  if (isChanged) {
                    confirmEdit();
                  } else {
                    cancel();
                  }
                } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (isChanged) {
                    confirmEdit();
                  } else {
                    cancel();
                  }
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancel();
                }
              },
            }),
          ),
          React.createElement(
            "div",
            { key: "edit-actions", style: style.editActionsRow },
            React.createElement(
              "button",
              {
                key: "btn-cancel",
                type: "button",
                className: "dsh-cancel-btn",
                disabled: busy,
                onClick: cancel,
              },
              t("cancel"),
            ),
            React.createElement(
              "button",
              {
                key: "btn-update",
                type: "button",
                className: "dsh-update-btn",
                style: {
                  background: isChanged
                    ? "var(--dsw-alias-button-info-fill, #679efe)"
                    : "var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,0.08))",
                  color: isChanged
                    ? "#ffffff"
                    : "var(--dsw-alias-label-caption, #81858c)",
                  fontWeight: isChanged ? 600 : 500,
                  cursor: isChanged && !busy ? "pointer" : "not-allowed",
                  opacity: isChanged ? 1 : 0.6,
                  boxShadow: isChanged ? "0 1px 3px rgba(0,0,0,0.2)" : "none",
                },
                disabled: busy || !isChanged,
                onClick: confirmEdit,
              },
              busy ? t("updating") : t("update"),
            ),
          ),
          error ? React.createElement("div", { key: "err", style: style.error }, error) : null,
        );
      }

      return React.createElement(
        "div",
        {
          style: style.row,
          onMouseEnter: (e) => {
            const actions = e.currentTarget.querySelector(".dsh-msg-actions");
            if (actions) actions.style.opacity = "1";
          },
          onMouseLeave: (e) => {
            const actions = e.currentTarget.querySelector(".dsh-msg-actions");
            if (actions) actions.style.opacity = "0.4";
          },
        },
        renderAttachmentsList(attachments, false),
        React.createElement("div", { key: "bubble", style: style.bubble }, text),
        React.createElement(
          "div",
          {
            key: "normal-actions",
            className: "dsh-msg-actions",
            style: { ...style.actions, opacity: 0.4, transition: "opacity 0.15s ease" },
          },
          React.createElement(
            "button",
            {
              key: "btn-copy",
              type: "button",
              className: "dsh-icon-btn",
              title: copied ? t("copied") : t("copy"),
              onClick: copy,
            },
            copied ? React.createElement(CheckIcon) : React.createElement(CopyIcon),
          ),
          React.createElement(
            "button",
            {
              key: "btn-pencil",
              type: "button",
              className: "dsh-icon-btn",
              title: t("editPrompt"),
              onClick: (e) => {
                if (e.currentTarget && typeof e.currentTarget.blur === "function") {
                  e.currentTarget.blur();
                }
                begin();
              },
            },
            React.createElement(PencilIcon),
          ),
        ),
      );
    }

    function createClientPlatformAdapter(ctx) {
      const uiWorkspace = ctx.get("uiWorkspace");
      const sessions = ctx.get("sessions");

      return {
        openSession(sessionId) {
          if (uiWorkspace && typeof uiWorkspace.openSession === "function") {
            uiWorkspace.openSession(sessionId);
            return;
          }
          if (sessions && typeof sessions.open === "function") {
            sessions.open(sessionId);
            return;
          }
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.set("session", sessionId);
            window.location.href = url.toString();
          }
        },
      };
    }

    const inject = ["slots", "remote"];

    async function apply(ctx) {
      ensureStyles();
      activeLocale = detectLocale(ctx);
      const platform = createClientPlatformAdapter(ctx);

      try {
        if (ctx && ctx.locale && typeof ctx.locale.subscribe === "function") {
          ctx.effect(() => {
            return ctx.locale.subscribe(() => {
              activeLocale = detectLocale(ctx);
            });
          }, "prompt-edit: locale");
        }
      } catch (_) {}

      let remote = undefined;
      try {
        const dispose = await ctx.remote.$mount(TYPERT_REMOTE);
        remote = ctx.get("remote.promptEdit");
        ctx.effect(() => async () => {
          remote = undefined;
          await dispose();
        }, "prompt-edit: remote");
      } catch (err) {
        console.error("prompt-edit: remote mount failed", err);
      }

      const api = () => {
        const r = remote || ctx.get("remote.promptEdit");
        if (r === undefined) throw new Error("promptEdit remote is not mounted yet");
        return r;
      };

      const registerChatNode = (key) =>
        ctx.slots.inject(
          "conversation.chat.node",
          () =>
            ctx.slots.register(
              {
                name: "conversation.chat.node",
                key,
                priority: -1,
                inject: (sessionId) => ({
                  sessionId,
                  resolve: (seq, text) => api().resolve(sessionId, seq, text),
                  detach: (sid) => api().detach(sid),
                  platform,
                }),
              },
              PromptEditUserNode,
            ),
        );

      registerChatNode("user");
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
