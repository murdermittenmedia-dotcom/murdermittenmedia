param(
  [Parameter(Mandatory = $true)][string]$Target,
  [switch]$Directory
)
$ErrorActionPreference = 'Stop'
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$owner = $identity.User
$acl = Get-Acl -LiteralPath $Target
$acl.SetAccessRuleProtection($true, $false)
foreach ($rule in @($acl.Access)) { [void]$acl.RemoveAccessRuleSpecific($rule) }
$acl.SetOwner($owner)
$inherit = if ($Directory) {
  [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
} else { [System.Security.AccessControl.InheritanceFlags]::None }
$rule = [System.Security.AccessControl.FileSystemAccessRule]::new($owner, [System.Security.AccessControl.FileSystemRights]::FullControl, $inherit, [System.Security.AccessControl.PropagationFlags]::None, [System.Security.AccessControl.AccessControlType]::Allow)
$acl.AddAccessRule($rule)
Set-Acl -LiteralPath $Target -AclObject $acl
# Administrators can still take ownership: this is owner-only ACL, not encryption.
