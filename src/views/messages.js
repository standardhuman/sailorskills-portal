/**
 * Customer Portal - Messages View
 * Two-way messaging with file attachments and real-time updates
 */

import {
  requireAuth,
  getCurrentUser,
  getEffectiveUser,
  getUserBoats,
  logout,
  isAdmin,
  setImpersonation,
  clearImpersonation,
} from "../auth/auth.js";
import { getAllCustomers } from "../api/customers.js";
import {
  loadConversations,
  loadThread,
  sendMessage,
  markAsRead,
  getUnreadCount,
  uploadAttachment,
  subscribeToMessages,
  unsubscribeFromMessages,
  formatMessageTime,
  formatFileSize,
  isImage,
} from "../api/messages.js";

// Require authentication
const isAuth = await requireAuth();
if (!isAuth) {
  throw new Error("Not authenticated");
}

// State
let currentUser = null;
let currentBoatId = null;
let conversations = [];
let selectedConversationId = null;
let currentMessages = [];
let messageSubscription = null;
let selectedFiles = [];

/**
 * Initialize impersonation banner
 */
async function initImpersonationBanner() {
  const impersonatedId = sessionStorage.getItem("impersonatedCustomerId");

  if (!impersonatedId) {
    return;
  }

  const bannerEl = document.getElementById("impersonation-banner");
  const searchInput = document.getElementById("banner-customer-search");
  const datalist = document.getElementById("banner-customer-datalist");
  const exitBtn = document.getElementById("exit-impersonation-btn");

  if (bannerEl) {
    bannerEl.style.display = "flex";
  }

  // Load all customers for banner selector
  const { customers, error } = await getAllCustomers();
  if (error) {
    console.error("Failed to load customers for banner:", error);
    return;
  }

  // Populate banner datalist
  customers.forEach((customer) => {
    const option = document.createElement("option");
    option.value = customer.displayText;
    option.dataset.customerId = customer.id;
    datalist.appendChild(option);
  });

  // Set current value to impersonated customer
  if (currentUser) {
    const currentCustomer = customers.find((c) => c.id === currentUser.id);
    if (currentCustomer) {
      searchInput.value = currentCustomer.displayText;
    }
  }

  // Handle banner customer selection (quick switch)
  searchInput.addEventListener("change", async (e) => {
    const selectedText = e.target.value;
    const selectedOption = Array.from(datalist.options).find(
      (opt) => opt.value === selectedText,
    );

    if (selectedOption) {
      const customerId = selectedOption.dataset.customerId;
      const { success } = await setImpersonation(customerId);
      if (success) window.location.reload();
    }
  });

  // Handle exit button
  if (exitBtn) {
    exitBtn.addEventListener("click", () => {
      clearImpersonation();
      window.location.reload();
    });
  }
}

/**
 * Initialize customer selector for admins
 */
async function initCustomerSelector() {
  const adminStatus = await isAdmin(currentUser.id);
  if (!adminStatus) return;

  const selectorEl = document.getElementById("admin-customer-selector");
  const searchInput = document.getElementById("customer-search");
  const datalist = document.getElementById("customer-datalist");

  if (!selectorEl || !searchInput || !datalist) return;
  selectorEl.style.display = "flex";

  const { customers, error } = await getAllCustomers();
  if (error) {
    console.error("Failed to load customers for selector:", error);
    return;
  }

  customers.forEach((customer) => {
    const option = document.createElement("option");
    option.value = customer.displayText;
    option.dataset.customerId = customer.id;
    datalist.appendChild(option);
  });

  searchInput.addEventListener("change", async (e) => {
    const selectedText = e.target.value;
    const selectedOption = Array.from(datalist.options).find(
      (opt) => opt.value === selectedText,
    );

    if (selectedOption) {
      const customerId = selectedOption.dataset.customerId;
      const { success } = await setImpersonation(customerId);
      if (success) window.location.reload();
    }
  });
}

/**
 * Initialize page
 */
async function init() {
  // Get current user
  const { user, error: userError } = await getEffectiveUser();
  if (userError || !user) {
    console.error("Error loading user:", userError);
    window.location.href = "/login.html";
    return;
  }

  currentUser = user;
  document.getElementById("user-email").textContent = user.email;

  // Initialize impersonation UI
  await initImpersonationBanner();
  await initCustomerSelector();

  // Get user's boats
  const { boats, error: boatsError } = await getUserBoats(currentUser.id);
  if (boatsError) {
    console.error("Error loading boats:", boatsError);
    return;
  }

  if (boats.length === 0) {
    showEmptyState("No boats found. Please contact support to link your boat.");
    return;
  }

  // Get current boat
  const savedBoatId = localStorage.getItem("currentBoatId");
  const boat = boats.find((b) => b.id === savedBoatId) || boats[0];
  currentBoatId = boat.id;

  // Load data
  await loadData();

  // Setup real-time updates
  setupRealtime();

  // Setup event listeners
  setupEventListeners();

  // Update unread count
  await updateUnreadCount();
}

/**
 * Load conversation data
 */
async function loadData() {
  const { conversations: convos, error } =
    await loadConversations(currentBoatId);

  if (error) {
    console.error("Error loading conversations:", error);
    showError("Failed to load conversations. Please try again.");
    return;
  }

  conversations = convos;
  renderConversations();

  // Auto-select first conversation if available
  if (conversations.length > 0 && !selectedConversationId) {
    selectConversation(conversations[0].id);
  }
}

/**
 * Render conversation list
 */
function renderConversations() {
  const container = document.getElementById("conversation-list");

  if (conversations.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No messages yet. Start a conversation by sending a message below!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = conversations
    .map((convo) => {
      const lastMessage = convo.messages[0]; // Already sorted desc
      const title = convo.service_log_id
        ? `Service #${convo.service_log_id.substring(0, 8)}`
        : "General";

      return `
      <div class="conversation-item ${convo.id === selectedConversationId ? "active" : ""}"
           data-conversation-id="${convo.id}"
           onclick="selectConversation('${convo.id}')">
        <div class="conversation-header">
          <span class="conversation-title">${title}</span>
          <span class="conversation-time">${formatMessageTime(lastMessage.created_at)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div class="conversation-preview">${lastMessage.message_text}</div>
          ${convo.unread_count > 0 ? `<span class="unread-badge">${convo.unread_count}</span>` : ""}
        </div>
      </div>
    `;
    })
    .join("");
}

/**
 * Select a conversation
 * @param {string} conversationId - Conversation ID
 */
window.selectConversation = async function (conversationId) {
  selectedConversationId = conversationId;

  // Update UI
  renderConversations();

  // Load thread
  const conversation = conversations.find((c) => c.id === conversationId);
  const serviceLogId = conversation?.service_log_id || null;

  const { messages, error } = await loadThread(currentBoatId, serviceLogId);

  if (error) {
    console.error("Error loading thread:", error);
    return;
  }

  currentMessages = messages;
  renderThread();

  // Mark admin messages as read
  const unreadIds = messages
    .filter((m) => m.sender_type === "admin" && !m.read_at)
    .map((m) => m.id);

  if (unreadIds.length > 0) {
    await markAsRead(unreadIds);
    await updateUnreadCount();
    await loadData(); // Refresh conversation list to update unread counts
  }
};

/**
 * Render message thread
 */
function renderThread() {
  const container = document.getElementById("message-thread");

  const conversation = conversations.find(
    (c) => c.id === selectedConversationId,
  );
  const title = conversation?.service_log_id
    ? `Service #${conversation.service_log_id.substring(0, 8)}`
    : "General Conversation";

  container.innerHTML = `
    <div class="thread-header">
      <h3>${title}</h3>
    </div>
    <div class="messages-scroll" id="messages-scroll">
      ${currentMessages.map((message) => renderMessage(message)).join("")}
    </div>
    <div class="message-composer">
      <form class="composer-form" id="composer-form">
        <div class="composer-input">
          <textarea id="message-input" placeholder="Type your message..." required></textarea>
        </div>
        <div class="composer-actions">
          <div class="file-input-wrapper">
            <input type="file" id="file-input" accept="image/*,.pdf,.doc,.docx" multiple>
            <button type="button" class="btn-file" id="attach-btn">📎 Attach File</button>
            <span class="selected-files" id="selected-files"></span>
          </div>
          <button type="submit" class="btn btn-primary">Send</button>
        </div>
      </form>
    </div>
  `;

  // Scroll to bottom
  setTimeout(() => {
    const scrollContainer = document.getElementById("messages-scroll");
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, 100);

  // Setup composer listeners
  setupComposerListeners();
}

/**
 * Render single message
 * @param {object} message - Message object
 * @returns {string}
 */
function renderMessage(message) {
  const senderClass = message.sender_type;
  const attachments = message.attachments || [];

  return `
    <div class="message-bubble ${senderClass}">
      <div class="message-content">
        <div class="message-text">${escapeHtml(message.message_text)}</div>
        ${
          attachments.length > 0
            ? `
          <div class="message-attachments">
            ${attachments
              .map((att) => {
                if (isImage(att.type)) {
                  return `<img src="${att.url}" alt="${att.filename}" class="attachment-image">`;
                } else {
                  return `
                  <a href="${att.url}" target="_blank" class="attachment-item">
                    📎 ${att.filename} (${formatFileSize(att.size)})
                  </a>
                `;
                }
              })
              .join("")}
          </div>
        `
            : ""
        }
      </div>
      <div class="message-time">${formatMessageTime(message.created_at)}</div>
    </div>
  `;
}

/**
 * Setup composer event listeners
 */
function setupComposerListeners() {
  const form = document.getElementById("composer-form");
  const attachBtn = document.getElementById("attach-btn");
  const fileInput = document.getElementById("file-input");

  form.addEventListener("submit", handleSendMessage);

  attachBtn.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", (e) => {
    selectedFiles = Array.from(e.target.files);
    updateSelectedFilesDisplay();
  });
}

/**
 * Handle send message
 * @param {Event} e - Submit event
 */
async function handleSendMessage(e) {
  e.preventDefault();

  const input = document.getElementById("message-input");
  const messageText = input.value.trim();

  if (!messageText && selectedFiles.length === 0) {
    return;
  }

  // Disable form
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Sending...";

  try {
    // Upload attachments first
    const attachments = [];
    for (const file of selectedFiles) {
      const { attachment, error } = await uploadAttachment(file, currentBoatId);
      if (error) {
        console.error("Error uploading file:", error);
        alert(`Failed to upload ${file.name}: ${error}`);
        continue;
      }
      attachments.push(attachment);
    }

    // Send message
    const conversation = conversations.find(
      (c) => c.id === selectedConversationId,
    );
    const serviceLogId = conversation?.service_log_id || null;

    const { message, error } = await sendMessage(
      currentBoatId,
      messageText,
      currentUser.id,
      attachments,
      serviceLogId,
    );

    if (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message. Please try again.");
      return;
    }

    // Clear form
    input.value = "";
    selectedFiles = [];
    document.getElementById("file-input").value = "";
    updateSelectedFilesDisplay();

    // Add message to UI (will also come via realtime, but this is faster)
    currentMessages.push(message);
    renderThread();
  } catch (error) {
    console.error("Send message error:", error);
    alert("Failed to send message. Please try again.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Send";
  }
}

/**
 * Update selected files display
 */
function updateSelectedFilesDisplay() {
  const display = document.getElementById("selected-files");
  if (selectedFiles.length === 0) {
    display.textContent = "";
  } else {
    display.textContent = `${selectedFiles.length} file(s) selected`;
  }
}

/**
 * Setup real-time message updates
 */
function setupRealtime() {
  // Unsubscribe from previous subscription
  if (messageSubscription) {
    unsubscribeFromMessages(messageSubscription);
  }

  // Subscribe to new messages
  messageSubscription = subscribeToMessages(
    currentBoatId,
    async (newMessage) => {
      console.log("New message received:", newMessage);

      // Update conversations list
      await loadData();

      // If message is for current thread, add it
      const conversation = conversations.find(
        (c) => c.id === selectedConversationId,
      );
      if (conversation) {
        const inCurrentThread =
          newMessage.service_log_id === conversation.service_log_id ||
          (!newMessage.service_log_id && !conversation.service_log_id);

        if (inCurrentThread) {
          currentMessages.push(newMessage);
          renderThread();

          // Mark as read if from admin
          if (newMessage.sender_type === "admin") {
            await markAsRead([newMessage.id]);
          }
        }
      }

      // Update unread count
      await updateUnreadCount();

      // Play notification sound (optional)
      if (newMessage.sender_type === "admin") {
        playNotificationSound();
      }
    },
  );
}

/**
 * Update unread count badge
 */
async function updateUnreadCount() {
  const { count, error } = await getUnreadCount(currentBoatId);

  if (error) {
    console.error("Error getting unread count:", error);
    return;
  }

  const badge = document.getElementById("unread-badge");
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = "block";
  } else {
    badge.style.display = "none";
  }
}

/**
 * Play notification sound
 */
function playNotificationSound() {
  // Optional: Play a notification sound
  // const audio = new Audio('/notification.mp3');
  // audio.play();
}

/**
 * Show empty state
 * @param {string} message - Message to display
 */
function showEmptyState(message) {
  const container = document.getElementById("conversation-list");
  container.innerHTML = `
    <div class="empty-state">
      <p>${message}</p>
    </div>
  `;
}

/**
 * Show error
 * @param {string} message - Error message
 */
function showError(message) {
  const container = document.getElementById("conversation-list");
  container.innerHTML = `
    <div class="empty-state">
      <p style="color: var(--ss-error-600);">${message}</p>
    </div>
  `;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string}
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Logout button
  document.getElementById("logout-btn").addEventListener("click", async () => {
    const { success } = await logout();
    if (success) {
      // Cleanup
      if (messageSubscription) {
        await unsubscribeFromMessages(messageSubscription);
      }
      window.location.href = "/login.html";
    }
  });
}

// Initialize page
init();

// Cleanup on page unload
window.addEventListener("beforeunload", async () => {
  if (messageSubscription) {
    await unsubscribeFromMessages(messageSubscription);
  }
});
